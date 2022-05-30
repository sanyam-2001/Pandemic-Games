const wxyzModel = require("../../../Models/wxyzModel");
const turnWXYZ = require("./turnWXYZ");
const disconnectWxyz = async (io,username, roomID, socket) => {
  const room = await wxyzModel.findOne({ roomID });
  if (room) {
    const newUserList = room.users.filter((user) => user.username !== username);
    var pos;
    var exist=[];
    room.users.map((user,ind)=>{
      if(user.username===username){
        pos=ind;
      }
      if(user.username!==username && user.lives>0){
        exist.push(ind);
      }
    });
    if(exist.length===1){
      console.log("ek banda bacha hai");
      socket.to(roomID).emit("WXYZwinner", {winner:exist[0]});
    }
    console.log("bye");
    var hasAdmin = false;
    var newAdmin;

    if(!newUserList[0])return;

    newUserList.forEach((user) => {
      if (user.isAdmin) {
        hasAdmin = true;
        newAdmin=user.username;
      }
    });

    //Make New Admin
    if(!hasAdmin){
      console.log("admin gaya")
      newAdmin=newUserList[0].username;
      newUserList[0].isAdmin = true;
      await wxyzModel.findOneAndUpdate({roomID, "users.username":newAdmin},
      {$set: {"users.$.isAdmin": true}})

      await wxyzModel.findOneAndUpdate({roomID, "users.username":username},
      {$set: {"users.$.isAdmin": false}})
      console.log("admin gaya aur change kardiya")
    }
    
    var newAdminPos;
    room.users.map((user,i)=>{
      if(user.username===newAdmin){
        newAdminPos=i;
      }
    })

    console.log("hello");
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
        console.log(i,"left user")
        socket.to(roomID).emit("WXYZcorrectAnswerRotate",{liveChecker:i});
        turnWXYZ(io,res,username,roomID);
      }},3000)
  }
};
module.exports = disconnectWxyz;
