// 필요한 모듈 및 라이브러리 import
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const fs=require('fs');

// Express 애플리케이션 설정
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

const multer = require('multer');

const storage = multer.diskStorage({
  destination: function (req, file, done) {
    done(null, './public/uploads'); // 원래 파일 이름으로 저장
  },
  filename:function(req,file,done){
    done(null,file.originalname);
  }
});

let upload = multer({ storage: storage });



// MySQL 연결 설정
const conn = mysql.createConnection({
    host: "127.0.0.1",
    user: "root",
    password: "1234",
    database: "myboard",
});

// MySQL 연결
conn.connect();

app.listen(8080, function () {
    console.log('포트 8080으로 서버 대기중...');
});
app.use(express.static('public'));
// 로그인 상태와 사용자 정보를 저장하는 변수
let loginStatus = false;
let loginID = '';
let loginUserNum = 1;
let nowviewnum=1;
let sortby=2;
let nowviewID=1;

let friendIDs = [];
//인덱스 페이지 라우팅
app.get('/', function (req, res) {
    conn.query("SELECT userNum, userID FROM user", function (err, rows, fields) {
        if (err) throw err;

        // 게시글 정보를 저장할 배열
        let postsArray = [];

        // 각 사용자에 대해 게시글 정보를 가져옴
        rows.forEach(user => {
            // 모든 사용자의 게시글 테이블을 최신순으로 정렬함
            conn.query(`SELECT * FROM user_${user.userNum} ORDER BY date ${sortby === '2' ? 'DESC' : 'ASC'}`, function (err, posts, fields) {
                if (err) throw err;
            });
        });

        sortby = 2; // 정렬 기준 전역변수 설정

        // 로그인 상태일 때 친구의 게시글 정보를 가져옴
        if (loginStatus === true) {
            conn.query(`SELECT friendNum,friendID FROM user_friend_${loginUserNum}`, function (err, friendsNum, fields) {
                

                console.log(friendsNum);
                if(friendsNum!=[]){
                    for (let i = 0; i < friendsNum.length; i++) {
                        // 수정: friendsID[i]로 변경
                        console.log('friendsNum'+i,friendsNum[i])
                        conn.query(`SELECT * FROM user_${friendsNum[i].friendNum} ORDER BY date DESC LIMIT 1`, function (err, friendPosts, field) {
                            postsArray.push({ userNum: friendsNum[i].friendID, posts: friendPosts });
                            // console.log(postsArray);
                            // console.log(friendPosts);
                            if(i==friendsNum.length-1){
                                console.log(postsArray);
                                res.render('index.ejs', { users: rows, loginStatus: loginStatus, my: loginID, postsArray: postsArray });
                            }
                        });
                    }
                    
                    
                }
            });
        
            // 정렬된 게시글 정보를 전달하여 렌더링
        }else{
            res.render('index.ejs', { users: rows, loginStatus: loginStatus, my: loginID, postsArray: null });
        }
    });
});

// 회원가입 라우트
app.get('/sign', function (req, res) {
    res.render('sign.ejs',{loginStatus: loginStatus});
});

// 회원가입 제출 라우트
app.post('/subsign', function (req, res) {
    let uid = req.body.userID;
    let upw = req.body.userPW;
    let check = req.body.checkuserPW;

    let checkUserExistenceQuery = "SELECT * FROM user WHERE userID = ?";

    conn.query(checkUserExistenceQuery, [uid], function (err, results) {
        if (err) throw err;

        if (results.length > 0) {
            res.send('<script>alert("이미 존재하는 ID입니다."); history.back();</script>');
        } else {
            if (upw === check) {
                let insertQuery = "INSERT INTO user(userID, userPW) VALUES (?, ?)";
                let params = [uid, upw];

                conn.query(insertQuery, params, function (err, result) {
                    if (err) throw err;

                    console.log('데이터 추가 성공');
                    let userNum = result.insertId;

                    let createTableQuery = `CREATE TABLE user_${userNum} (
                        num INT AUTO_INCREMENT,
                        title VARCHAR(255) NOT NULL,
                        content TEXT NOT NULL,
                        date VARCHAR(255) NOT NULL,
                        file VARCHAR(255) NULL,
                        PRIMARY KEY (num)
                    )`;
                    let createFriendTable=`CREATE TABLE user_friend_${userNum}(
                        num INT AUTO_INCREMENT,
                        friendID VARCHAR(40) NOT NULL,
                        friendNum INT NOT NULL,
                        PRIMARY KEY(num)
                    )`;

                    conn.query(createTableQuery, function (err, createResult) {
                        if (err) throw err;
                        conn.query(createFriendTable,function(err,createResult){
                            if(err) throw err;
                        console.log(`테이블 생성 성공: user_${userNum}`);
                        conn.query("SELECT userID FROM user", function (err, rows, fields) {
                            if (err) throw err;
                            res.redirect('/');
                        });
                    });
                });
                });
            } else {
                res.send('<script>alert("비밀번호와 비밀번호 확인이 일치하지 않습니다."); history.back();</script>');
            }
        }
    });
});

// 로그인 라우트
app.get('/login', function (req, res) {
    res.render('login.ejs',{loginStatus: loginStatus});
});

// 로그인 제출 라우트
app.post('/sublog', function (req, res) {
    let uid = req.body.userID;
    let upw = req.body.userPW;

    let checkUserQuery = "SELECT * FROM user WHERE userID = ?";

    conn.query(checkUserQuery, [uid], function (err, results) {
        if (err) throw err;

        if (results.length > 0) {
            let storedPassword = results[0].userPW;

            if (upw === storedPassword) {
                console.log('로그인 성공');
                loginStatus = true;
                loginID = uid;
                loginUserNum = results[0].userNUM;
                nowviewnum=loginUserNum;
                console.log('로그인 한 아이디는 ', loginID);
                console.log('로그인 한 사용자의 userNum은 ', loginUserNum);
                conn.query("SELECT * FROM user_" + loginUserNum, function (err, rows, fields) {
                    if (err) throw err;
                    console.log(rows);
                    let rowdata = rows;
                    conn.query("SELECT userID FROM user", function (err, userRows, fields) {
                        if (err) throw err;
                        res.redirect('/')//, { data: rowdata, users: userRows, my: loginID, loginStatus: loginStatus, sortBy:sortby });
                    });
                });
            } else {
                console.log('비밀번호가 일치하지 않습니다.');
                res.send('<script>alert("비밀번호가 일치하지 않습니다."); history.back();</script>');
            }
        } else {
            console.log('사용자가 존재하지 않습니다.');
            res.send('<script>alert("존재하지 않는 사용자입니다."); history.back();</script>');
        }
    });
});

// 로그아웃 라우트
app.get('/logout', function (req, res) {
    loginStatus = false;
    loginID = '';
    loginUserNum = null;
    nowviewnum=null;
    conn.query("SELECT userID FROM user", function (err, rows, fields) {
        if (err) throw err;
        res.redirect('/')
    });
});

// 블로그 페이지 라우트
app.get('/blog/:userID', function (req, res) {
    let targetUserID = req.params.userID;
    nowviewID=targetUserID
    let getUserNumQuery = "SELECT userNum FROM user WHERE userID = ?";

    conn.query(getUserNumQuery, [targetUserID], function (err, userResult) {
        if (err) throw err;

        if (userResult.length > 0) {
            let userNum = userResult[0].userNum;//userNum은 사용자 테이블에서 사용자 번호
            nowviewnum=userNum;
            let getUserBlogQuery = "SELECT * FROM user_" + userNum;

            conn.query(getUserBlogQuery, function (err, blogResult) {//blogresult엔 불러올 사용자 게시판의 테이블 정보
                if (err) throw err;

                let getAllUsersQuery = "SELECT userID FROM user";

                conn.query(getAllUsersQuery, function (err, userRows) {
                    if (err) throw err;
                    console.log('블로그 화면 접속 시 로그인 한 사용자',loginID,loginUserNum);
                    console.log('블로그 주인 정보',targetUserID);
                    res.render('blog.ejs', { data: blogResult, my: targetUserID, users: userRows, loginStatus: loginStatus, nowid:loginID, sortBy:sortby });
                });
            });
        } else {
            res.send('사용자를 찾을 수 없습니다.');
        }
    });
});

// 게시물 보기 페이지 라우트
// app.get('/viewpost/:postNum', function (req, res) {
//     let postNum = req.params.postNum;
//     let userNum = loginUserNum;

//     let query = `SELECT * FROM user_${userNum} WHERE num = ?`;

//     conn.query(query, [postNum], function (err, result) {
//         if (err) throw err;

//         res.render('viewpost.ejs', { data: result[0],loginStatus: loginStatus });
//     });
// });

app.get('/viewpost/:user/:num', function (req, res) {
    let userID = req.params.user;
    let num = req.params.num;

    let getUserNumQuery = "SELECT userNum FROM user WHERE userID = ?";

    conn.query(getUserNumQuery, [userID], function (err, userResult) {
        if (err) throw err;

        if (userResult.length > 0) {
            let userNum = userResult[0].userNum;

            let getPostQuery = "SELECT * FROM user_" + userNum + " WHERE num = ?";

            conn.query(getPostQuery, [num], function (err, postResult) {
                if (err) throw err;
                console.log('뷰포스트에서 파일 경로',postResult[0].file);
                res.render('viewpost.ejs', {
                    data: postResult[0],
                    loginStatus: loginStatus,
                    num: userNum,
                    nowid: loginID,
                    sortBy:sortby
                });
            });
        } else {
            res.send('사용자를 찾을 수 없습니다.');
        }
    });
});



app.get('/write',function(req,res){
    res.render('write.ejs',{loginStatus:loginStatus});
});

app.get('/editcon/:id',function(req,res){
    console.log(req.params.id);
    let postnum=req.params.id;
    conn.promise().query('SELECT * FROM user_'+loginUserNum+" WHERE num=?",[postnum])
    .then(result=>{
        // console.log(result[0]);
        // console.log(result[0][0]);
        // console.log(result[0][0].title);
        // console.log(result[0][0].content);
        res.render('editcon.ejs',{data:result[0][0], loginStatus:loginStatus});
    }).catch(err=>{
        console.log(err);
        res.status(500).send();
    })
});

// 게시글 수정 라우트
app.post('/edit/:id', upload.single('new_file'), function(req, res) {
    console.log('수정 시도');
    let postnum = req.params.id;
    let currentDate = new Date();
    
    // 작성 일자를 년, 월, 일로 추출
    let year = currentDate.getFullYear();
    let month = ('0' + (currentDate.getMonth() + 1)).slice(-2); // 0부터 시작하므로 +1 필요
    let day = ('0' + currentDate.getDate()).slice(-2);

    let formattedDate = `${year}-${month}-${day}`;

    // 파일이 전송되었는지 확인
    let filePath = req.file ? ('/'+req.file.path.replace(/\\/g, '/').split('public/').pop()) : req.body.file;
    
    console.log(' 파일 경로', filePath);

    conn.promise().query(`UPDATE user_${loginUserNum}
                          SET title = ?, content = ?, date = ?, file = ?
                          WHERE num = ?`,
                          [req.body.title, req.body.content, formattedDate, filePath, postnum])
    .then(result => {
        console.log('수정 성공');
        res.redirect('/blog/'+loginID);  // 수정 후 홈 페이지로 리다이렉트 또는 다른 페이지로 리다이렉트
    })
    .catch(err => {
        console.log(err);
        res.status(500).send();
    });
});





// 게시물 삭제 라우트
app.post('/deleteboard', function (req, res) {
    const postId = req.body.num;
    conn.promise().query("DELETE FROM user_" + loginUserNum + " WHERE num = ?", [postId])
        .then(result => {
            console.log('삭제완료');
            res.send({ redirect: '/blog/'+loginID });
        }).catch(err => {
            console.log(err);
            res.send({ redirect: '/blog/'+loginID });
        });
});

// 게시글 작성 라우트
app.post('/savesql', upload.single('file'), function (req, res) {
    // console.log(req.body.title);
    // console.log(req.body.content);
    // console.log(req.file.path);
    let currentDate = new Date();
    
    // 작성 일자를 년, 월, 일로 추출
    let year = currentDate.getFullYear();
    let month = ('0' + (currentDate.getMonth() + 1)).slice(-2); // 0부터 시작하므로 +1 필요
    let day = ('0' + currentDate.getDate()).slice(-2);

    let formattedDate = `${year}-${month}-${day}`;

    // 파일이 전송되었는지 확인
    let filePath = req.file ? req.file.path.replace(/\\/g, '/').split('public/').pop() : null;
    filePath='/'+filePath;
    console.log(' 파일 경로',filePath)

    let check_txt=filePath;
    check_txt=check_txt.slice(-3)
    console.log('check_txt',check_txt);
    if(check_txt=='txt'){
        const fullFilePath = `./public${filePath}`;
        fs.promises.readFile(fullFilePath, 'utf8')
        .then(filetxt => {
            filePath = null;
            req.body.content = req.body.content +'\n' +filetxt;
            console.log('파일 내용', filetxt);
                // 파일이 전송되었다면 파일을 저장, 아니면 NULL
    let sql = "INSERT INTO user_" + loginUserNum + "(title, content, date, file) VALUES (?, ?, ?, ?)";
    let params = [req.body.title, req.body.content, formattedDate, filePath,];

    conn.query(sql, params, function (err, result) {
        if (err) throw err;

        conn.query("SELECT * FROM user_" + loginUserNum, function (err, rows, fields) {
            if (err) throw err;

            let rowdata = rows;
            res.redirect('/blog/' + loginID);
        });
    });
        })
        .catch(error => {
            console.error('파일 읽기 오류:', error);
        });
    }else{
    // 파일이 전송되었다면 파일을 저장, 아니면 NULL
    let sql = "INSERT INTO user_" + loginUserNum + "(title, content, date, file) VALUES (?, ?, ?, ?)";
    let params = [req.body.title, req.body.content, formattedDate, filePath,];

    conn.query(sql, params, function (err, result) {
        if (err) throw err;

        conn.query("SELECT * FROM user_" + loginUserNum, function (err, rows, fields) {
            if (err) throw err;

            let rowdata = rows;
            res.redirect('/blog/' + loginID);
        });
    });
}
});




app.get('/friend', function(req, res) {
    conn.query("SELECT userNum FROM user WHERE userID = ?", [loginID], function(err, userNumResults, fields) {
        if (err) throw err;

        if (userNumResults.length > 0) {
            let loginUserNum = userNumResults[0].userNum;

            conn.query("SELECT * FROM user_friend_" + loginUserNum, function(err, friendrows, fields) {
                if (err) throw err;

                res.render('friend.ejs', { data: friendrows, my: loginID, user: loginUserNum, loginStatus: loginStatus });
            });
        } else {
            // 로그인 사용자의 정보를 찾을 수 없는 경우
            console.log('로그인 사용자 정보를 찾을 수 없습니다.');
            res.send('<script>alert("로그인 사용자 정보를 찾을 수 없습니다."); history.back();</script>');
        }
    });
});

app.post('/addfriend', function(req, res) {
    console.log("추가할 친구 아이디", req.body.newFriendID);

    conn.query("SELECT userNum FROM user WHERE userID = ?", [loginID], function(err, results) {
        if (err) throw err;

        if (results.length > 0) {
            let loginUserNum = results[0].userNum;
            let newFriendID = req.body.newFriendID;

            // 새로운 친구 아이디가 사용자 테이블에 있는지 확인
            let checkUserExistenceQuery = "SELECT userNum FROM user WHERE userID = ?";

            conn.query(checkUserExistenceQuery, [newFriendID], function(err, results) {
                if (err) throw err;

                if (results.length > 0) {
                    let friendUserNum = results[0].userNum;

                    // 이미 친구인지 확인
                    let checkFriendshipQuery = `SELECT * FROM user_friend_${loginUserNum} WHERE num = ?`;

                    conn.query(checkFriendshipQuery, [friendUserNum], function(err, friendshipResults) {
                        if (err) throw err;

                        // 아직 친구가 아닌 경우, 새로운 친구 추가
                        if (friendshipResults.length === 0) {
                            let addFriendshipQuery = `INSERT INTO user_friend_${loginUserNum} (friendID, friendNum) VALUES (?,?)`;
                    
                            conn.query(addFriendshipQuery, [newFriendID,friendUserNum], function(err, result) {
                                if (err) throw err;

                                console.log('친구 추가 완료');
                                res.redirect('/friend');  // 친구 추가 후 친구 페이지로 리다이렉트
                            });
                        } else {
                            // 이미 친구인 경우
                            console.log('이미 친구입니다.');
                            res.send('<script>alert("이미 친구입니다."); history.back();</script>');
                        }
                    });
                } else {
                    // 사용자 테이블에 해당 아이디가 없는 경우
                    console.log('존재하지 않는 ID입니다.');
                    res.send('<script>alert("존재하지 않는 ID입니다."); history.back();</script>');
                }
            });
        } else {
            // 로그인 사용자의 정보를 찾을 수 없는 경우
            console.log('로그인 사용자 정보를 찾을 수 없습니다.');
            res.send('<script>alert("로그인 사용자 정보를 찾을 수 없습니다."); history.back();</script>');
        }
    });
});

app.post('/deletefriend',function(req,res){
    const delfriend=req.body.fid;
    conn.promise().query("DELETE FROM user_friend_" + loginUserNum + " WHERE friendID = ?", [delfriend])
        .then(result => {
            console.log('삭제완료');
            res.status(200).send();
        }).catch(err => {
            console.log(err);
            res.status(500).send();
        });
})

app.get('/sort', function(req, res) {
    let sortBy = req.query.sortBy;

    // 기본적으로는 오래된 순으로 정렬
    let orderBy = 'ASC';

    // 최근 순으로 정렬하려면 orderBy를 DESC로 변경
    if (sortBy === '2') {
        orderBy = 'DESC';
    }

    // 정렬된 게시글을 가져오는 쿼리
    let getSortedPostsQuery = `SELECT * FROM user_${nowviewnum} ORDER BY num ${orderBy}`;

    conn.query(getSortedPostsQuery, function(err, result) {
        if (err) throw err;

        // 블로그 페이지를 렌더링할 때 필요한 데이터

        let getAllUsersQuery = "SELECT userID FROM user";

        conn.query(getAllUsersQuery, function (err, userRows) {
            if (err) throw err;
            // console.log('블로그 화면 접속 시 로그인 한 사용자',loginID,loginUserNum);
            // console.log('블로그 주인 정보',targetUserID);
            let renderData = {
                
            };
            res.render('blog.ejs', { data: result,loginStatus: loginStatus, my: nowviewID, nowid: loginID, users:userRows, sortBy: sortBy  });
        });
    });
});
