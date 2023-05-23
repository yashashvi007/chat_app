const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema({
    userName : {
        type : String  , 
        unique : true
    }, 
    password : String
} , {timestamps : true})


const UserModel = mongoose.model('User' , UserSchema)
module.exports = UserModel