const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const app = express();
app.use(express.json());
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const dbpath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB error:${e.message}`);
  }
};

initializeDbAndServer();
const convertDbObjectToResponseObject = (dbobject) => {
  return {
    stateId: dbobject["state_id"],
    stateName: dbobject["state_name"],
    population: dbobject["population"],
    districtId: dbobject["district_id"],
    districtName: dbobject["district_name"],
    stateId: dbobject["state_id"],
    cases: dbobject["cases"],
    cured: dbobject["cured"],
    active: dbobject["active"],
    deaths: dbobject["deaths"],
  };
};

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "CCBP", (error, user) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const query = `select * from user WHERE username='${username}';`;
  const dbuser = await db.get(query);
  //console.log(dbuser);

  if (dbuser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbuser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "CCBP");
      response.send({ jwtToken });
      //console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", authenticationToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state`;
  const statesArray = await db.all(getStatesQuery);
  response.send(
    statesArray.map((eachItem) => {
      return convertDbObjectToResponseObject(eachItem);
    })
  );
});

app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStatesQuery = `SELECT * FROM state WHERE state_id=${stateId}`;
  const statesArray = await db.get(getStatesQuery);
  response.send(convertDbObjectToResponseObject(statesArray));
});

app.post("/districts/", authenticationToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const createDistrictQuery = `INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
    VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getStatesQuery = `SELECT * FROM district WHERE district_id=${districtId}`;
    const statesArray = await db.get(getStatesQuery);
    response.send(convertDbObjectToResponseObject(statesArray));
  }
);

app.delete(
  "/districts/:districtId",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const Query = `DELETE FROM district WHERE district_id=${districtId}`;
    const result = await db.get(Query);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const districtDetails = request.body;
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const Query = `UPDATE district SET district_name='${districtName}',state_id=${stateId},cases=${cases},cured=${cured},active=${active},deaths=${deaths}
  WHERE district_id=${districtId};`;
    await db.run(Query);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `SELECT sum(cases),
  sum(cured),
  sum(active),
  sum(deaths) FROM district WHERE state_id=${stateId}`;
    const statsArray = await db.get(getStatsQuery);
    //console.log(statsArray);
    response.send({
      totalCases: statsArray["sum(cases)"],
      totalCured: statsArray["sum(cured)"],
      totalActive: statsArray["sum(active)"],
      totalDeaths: statsArray["sum(deaths)"],
    });
  }
);

app.get(
  "/districts/:districtId/details/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictIdQuery = `
select state_id from district
where district_id = ${districtId};
`; //With this we will get the state_id using district table
    const getDistrictIdQueryResponse = await db.get(getDistrictIdQuery);

    const getStateNameQuery = `
select state_name as stateName from state
where state_id = ${getDistrictIdQueryResponse.state_id};
`; //With this we will get state_name as stateName using the state_id
    const getStateNameQueryResponse = await db.get(getStateNameQuery);
    response.send(getStateNameQueryResponse);
  }
); //sending the required response

module.exports = app;
