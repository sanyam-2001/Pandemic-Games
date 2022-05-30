const wxyzModel = require("../../../Models/wxyzModel");

const turnWXYZ=async(io,res,username,roomID)=>{
    var currUser=username,nextUser;
    await wxyzModel.findOne({roomID},(err,room)=>{
        if (err) {
            console.log(err);
        }else{
            room.users.map((user,i)=>{
                if(i===res.position){
                    nextUser=user.username;
                }
            })
        }
    })
    await wxyzModel.findOneAndUpdate({roomID, "users.username": currUser},
    {$set: {"users.$.isTurn": false}})

    await wxyzModel.findOneAndUpdate({roomID, "users.username": nextUser},
    {$set: {"users.$.isTurn": true}})

    io.in(roomID).emit("WXYZTurn", { position: res.position});
}

module.exports = turnWXYZ;