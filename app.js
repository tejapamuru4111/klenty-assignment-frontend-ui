const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const format = require("date-fns/format");
const { v4: uuidv4 } = require("uuid");

const databasePath = path.join(__dirname, "sampleRegister.db");

const app = express();

app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3001, () =>
      console.log("Server Running at http://localhost:3001/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const answersList = (id, ansObj) => {
  const finalAns = ansObj.filter((ans) => {
    if (id == ans.faq_id) {
      return ans.answer;
    }
  });

  return finalAns;
};

const convertUsableObject = (faqObj, ansObj) => {
  const finalObj = faqObj.map((faq) => ({
    faqId: faq.faq_id,
    question: faq.question,
    answers: answersList(faq.faq_id, ansObj),
  }));
  return finalObj;
};

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

app.post("/register/", async (request, response) => {
  const { id, username, password, lastname, firstname, gender } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE user_name = '${username}';`;
  const databaseUser = await database.get(selectUserQuery);
  if (databaseUser !== undefined) {
    response.status(400);
    response.send("username already exist");
  } else {
    const hashedPassword = await bcrypt.hash(password, 10);
    const insertUserQuery = `INSERT INTO user VALUES(${id},'${firstname}','${lastname}','${username}', '${hashedPassword}', '${gender}');`;
    await database.run(insertUserQuery);
    response.status(200);
    response.send("created user successfully");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE user_name = '${username}';`;
  const databaseUser = await database.get(selectUserQuery);
  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.status(200);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/", authenticateToken, async (request, response) => {
  const { search = "" } = request.query;
  const getFaqsQuery = `
    SELECT
      *
    FROM
      faqs
    WHERE question LIKE '%${search}%'
    ORDER BY posted_date DESC;`;
  const getAnswersQuery = `
    SELECT
      *
    FROM
      faqs_ans
    ORDER BY posted_date ASC;`;
  const faqsArray = await database.all(getFaqsQuery);
  const answersArray = await database.all(getAnswersQuery);
  response.send(convertUsableObject(faqsArray, answersArray));
});

app.post("/", authenticateToken, async (request, response) => {
  const { f_id, que, ans } = request.body;
  const uuid = uuidv4();
  const date = new Date();
  const presentDate = format(date, "yyyy-MM-d H:m:s");

  if (que !== undefined) {
    const postFaqQuery = `
  INSERT INTO
    faqs 
  VALUES
    (${f_id}, '${que}', '${presentDate}');`;
    await database.run(postFaqQuery);
  }

  const postAnswerQuery = `
  INSERT INTO
    faqs_ans
  VALUES
    ('${uuid}', '${ans}', ${f_id}, '${presentDate}');`;
  await database.run(postAnswerQuery);
  response.send("Successfully Added");
});

module.exports = app;
