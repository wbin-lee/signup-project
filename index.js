const express = require("express");
const app = express();
const PORT = 8080;
const multer = require("multer");
const cookieParser = require("cookie-parser");
const {hashPassword, comparedPassword} = require('./utils/bcrypt')
const db = require("./models")
const path = require("path");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.set("view engine", "ejs");

const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, done) => {
        done(null, "uploads/");
      },
      filename: (req, file, done) => {
        const ext = path.extname(file.originalname);
        done(null, path.basename(file.originalname, ext) + Date.now() + ext);
      },
    }),
  });

const authentication = async (req, res, next) => {
    //console.log(req.cookies["loginId"]);
    if (req.cookies["loginId"]) {
      try {
        const userInformation = await db["user"].findOne({
          where: {
            id: req.cookies["loginId"],
          },
        });
        //   Node 전역변수
        res.locals.user = userInformation.dataValues;
      } catch (error) {
        res.locals.user = null;
      }
    }
    next();
  };
  app.use(authentication);


app.get("/", (req, res) =>{
    return res.render("index");
});

app.get("/login", (req, res) => {
    return res.render("login");
})

app.get("/signup", (req, res) => {
    return res.render("signup");
})

app.get("/board", async (req, res) => {
    try {
      const data = await db["board"].findAll({
        include: [
          { model: db["user"], attributes: ["id", "name"] },
          { model: db["file"] },
        ],
      });
      // dataValues 
      const result = data.map(el => el.get({plain:true}));
      // console.log(result);
      // console.log(data);
      return res.render("board", {board: result});
    } catch (error) {
      return res.render("board");
    }
  });

app.get("/create", (req, res) => {
    return res.render("create");
})

app.get("/welcome", async(req, res) => {
  try {
    const loginName = await db["user"].findOne({
      where: {
        id: req.cookies["loginId"],
      },
    });
    res.locals.user = loginName.dataValues;
  } catch (error) {
    console.log(error);
  }
  
    return res.render("welcome");
})

app.post("/register", async(req, res) => {
    try {
        //req.body가  잘넘어오는지 확인
        //비밀번호 암호화
        //req.body의 정보와 암호화된 비밀번호를 db에 넣는다.
        //성공시 return
        console.log(req.body);
        const {name, hobby, age, email, password} = req.body;
        const hashedPassword = await hashPassword(password);
        console.log(hashedPassword);
        const data = await db["user"].create({
            name: name,
            hobby: hobby,
            age: age,
            email: email,
            password: hashedPassword
        });
        return res.render("logic", {type:"register", result:true});
        
    } catch (error) {
        console.log(error);
        return res.render("logic", {type:"register", result:false});
    }
})

app.post("/login", async(req, res) => {
    try {
        console.log(req.body);
        const {email, password} = req.body;
        // req.body를 받아온다
        // req.body로부터 받은 이메일을
        // db에 findOne으로 (조건 email = 받아온 이메일)찾아서 db의 email과 password를 찾아온다
        const data = await db["user"].findOne({ 
            where: { email: email}
        });
        //console.log(data.dataValues.password);
        const hashedPassword = data.dataValues.password;
        const result = await comparedPassword(password, hashedPassword);
        //console.log(password);
        //console.log(hashedPassword);
        //return res.json(data);
        
        // req.body로부터 받아온 password와 db에 있는 password를 비교(선언해둔 comparePassword)
        //comparedPassword가 true면 로그인 성공
        if(result){
            // 쿠키에 저장한다
            // 기본적으로 http는 무상태이다.
            // 상태를 저장하지 않는다
            // 따라서 로그인을 유지하는 수단 필요
            // 전통적인 방식이 쿠키
            
            // 쿠키중 loginid가 존재하는 경우, 로그인이 유지
            res.cookie("loginId", data.dataValues.id, {
                expires: new Date(Date.now() + 1000 * 60 )
            })
            return res.render("logic", {type:"login", result:true})
        }
        // 로그인 실패
        return res.render("logic", {type:"login", result:false})
    } catch (error) {
        console.log(error);
        return res.render("logic", {type:"login", result:false})
    }
})


app.get("/logout", (req, res) => {
    res.clearCookie("loginId");
    res.locals.user = null;
    return res.redirect("/");
})

app.post("/post", upload.single("file"), async(req, res) => {
    console.log(req.body);
    console.log(req.file);
    // upload가 잘 진행되는지 확인 및 body 출력
    // 먼저 boards에 title, content, 그리고 user_id에 로그인 정보 넣기
    // 해당 작성된 계시글의 id를 받아서 files테이블에 정보를 넣어준다.
    // originalname, filename, board_id

    try {
        const {title, content} = req.body;
        const post = await db['board'].create({
            title: title, 
            content: content, 
            user_id: res.locals.user.id
        });

        if(req.file) {
            await db["file"].create({
                filename: req.file.filename,
                originalname: req.file.originalname,
                board_id: post.dataValues.id
            })
        }
        return res.render("logic", {type:"post", result:true})
    } catch (error) {
        console.log(error);
        return res.render("logic", {type:"post", result:false})
    }
})

app.get("/download/:id",async (req, res) => {
    const fileData = await db['file'].findOne({
        where:{
            id:req.params.id
        }
    });
    console.log(fileData.dataValues);
    const {filename, originalname} = fileData.dataValues;
    console.log(filename,originalname);
    return res.download(`./uploads/${filename}`, originalname);
})

app.use(express.static('./static'))
app.listen(PORT, () => console.log(`this server listening on ${PORT}`));
