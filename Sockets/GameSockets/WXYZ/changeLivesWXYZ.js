const wxyzModel = require("../../../Models/wxyzModel");

const changeLivesWXYZ=async(io,res,username,roomID)=>{
    console.log(username,res.lives); 
    await wxyzModel.findOneAndUpdate({roomID, "users.username": username},
    {$set: {"users.$.lives": res.lives}})
    io.in(roomID).emit("WXYZReduceLives",res);
}

module.exports = changeLivesWXYZ;