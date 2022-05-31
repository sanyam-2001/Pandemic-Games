const wxyzModel = require("../../../Models/wxyzModel");
const turnWXYZ = require("./turnWXYZ");
const disconnectWxyz = async (io,username, roomID, socket) => {
  const room = await wxyzModel.findOne({ roomID });
  if (room) {
    var pos,newAdminPos,oldAdmin=room.adminUsername,newAdmin,hasAdmin=false;
    var exist=[];

    for(let i=0;i<room.users.length;i++){
      if(room.users[i].username===username){
        pos=i;
      }
      if(room.users[i].username!==username && room.users[i].lives>0){
        exist.push(i);
      }
      if(room.users[i].username===oldAdmin){
        newAdminPos=i;
      }
    }
    
    if(exist.length===1){
      socket.to(roomID).emit("WXYZwinner", {winner:exist[0]});
    }

    if(exist.length===0)return;

    if(oldAdmin!==username){
      hasAdmin=true;
      newAdmin=oldAdmin;
    }

    //Make New Admin
    if(!hasAdmin){
      newAdmin=room.users[exist[0]].username;
      newAdminPos=exist[0];
      room.users[exist[0]].isAdmin = true;
      await wxyzModel.findOneAndUpdate({roomID, "users.username":newAdmin},
      {$set: {"users.$.isAdmin": true}})

      await wxyzModel.findOneAndUpdate({roomID, "users.username":username},
      {$set: {"users.$.isAdmin": false}})
    }

    socket.to(roomID).emit("changeWxyzAdmin", {
      adminUsername: newAdminPos,
      leftUsername: pos,
    });

    await wxyzModel.findOneAndUpdate({roomID, "users.username": username},
    {$set: {"users.$.lives": 0}})

    await wxyzModel.findOneAndUpdate(
      { roomID },
      { adminUsername: newAdmin }
    );
    setTimeout(async()=>{
      const leftUser=await wxyzModel.findOne(  
        { roomID, "users.isTurn" : true },
        { "users.$": 1 }
      );
      var turn=false;
      if(leftUser)
        turn=leftUser.users[0].username===username;
      //if its left user's turn
      if(turn){
        let i = 1;
        while (true) {
          let livesCheck = room.users[(pos + i) % room.users.length].lives;
          if (livesCheck > 0) {
            if ((pos + i) % room.users.length === pos) {
              i = -1;
            }
            break;
          } else {
            i++;
          }
        }
        const res={
          position: ((pos + i)%room.users.length) 
        }
        socket.to(roomID).emit("WXYZcorrectAnswerRotate",{liveChecker:i});
        turnWXYZ(io,res,username,roomID);
      }},3000)
  }
};
module.exports = disconnectWxyz;
