const express = require('express')
const mongoose = require('mongoose')
const dotenv =require('dotenv')
const jwt = require('jsonwebtoken')
const User = require('./models/User')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const bcrypt = require('bcrypt')
const ws = require('ws')

dotenv.config()
mongoose.connect(process.env.mongodburl).then(()=> {
    console.log("connected");
})
const jwtSecret = process.env.JWT_SECRET
const bcryptSalt = bcrypt.genSaltSync(10);
const app = express()

// app.use((req, res, next) => {
//     res.header('Access-Control-Allow-Origin', '*');
//     next();
// });

app.use(cors({
    origin : 'http://localhost:3000'
}))

app.use(express.json())
app.use(cookieParser())

app.get('/test' , (req , res)=> {
    res.json('test ok');    
})

app.post('/profile' , (req , res)=> {
    console.log(req.body);
    const token = req.body.token ;
    console.log(token , "token");
    if(token){
        jwt.verify(token , jwtSecret , {} , (err , userData)=> {
            if(err) throw err ; 
            const {id , userName} = userData
    
            res.json(userData)
        })
    }else {
        res.status(401).json('no token')
    }
})


app.post('/login' , async (req , res)=> {
    const {userName , password} = req.body
    const foundUser = await User.findOne({userName})
    if(foundUser){
      const passOk =  bcrypt.compareSync(password , foundUser.password)
      if(passOk){
        jwt.sign({userId : foundUser._id , userName} , jwtSecret , (err , token)=> {
            if(err){
                throw err;
            }
            res.cookie('token' , token , {sameSite : 'none' , secure : true}).status(201).json({
                id : foundUser._id , 
                userName , 
                token
            });
        })
      }
    }
})


app.post('/register' ,async (req , res)=> {
    const {userName , password} = req.body
    try {
        const hashedPassword = bcrypt.hashSync(password , bcryptSalt)
        const createdUser = await User.create({
            userName , 
            password : hashedPassword
        })
        await createdUser.save()
        jwt.sign({userId : createdUser._id , userName} , jwtSecret , (err , token)=> {
            if(err){
                throw err;

            }
            res.cookie('token' , token , {sameSite : 'none' , secure : true}).status(201).json({
                id : createdUser._id , 
                userName , 
                token
            });
        })
        
    } catch (error) {
        if(error) throw error;
    }
    
})

const server = app.listen(4000)


const wss = new ws.WebSocketServer({server})
wss.on('connection' , (connection , req)=> {
    const cookies = req.headers.cookie;
    if(cookies){
      const tokenCookieString = cookies.split(';').find(str => str.startsWith('token='))
      if(tokenCookieString){
        const token = tokenCookieString.split('=')[1]
        if(token){
            jwt.verify(token , jwtSecret , {} , (err , userData)=> {
                if(err) throw err;
                const {userId , userName} = userData
                connection.userId = userId
                connection.userName = userName
            })
        }
      }
    }


    connection.on('message' , (message) => {
       console.log("in message");
       const messageData = JSON.parse(message.toString());
       console.log(messageData);
       const {recipient , text} = messageData.message;
       console.log(recipient);
       [...wss.clients].map(c => console.log(c.userId) );
       if(recipient && text){
        [...wss.clients]
        .filter(c => c.userId === recipient)
        .forEach(c => c.send(JSON.stringify({text , sender : connection.userId })));
       }
    });


    [...wss.clients].forEach(client => {
        client.send(JSON.stringify({
          online: [...wss.clients].map(c => ({userId : c.userId, userName: c.userName}))
        }))
    })
})