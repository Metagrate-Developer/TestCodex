function learning(){
  let frutas = ["pizza","arroz","maiz","pera",];
  for (i = 0; i in frutas; i++){
    if (frutas[i].includes("pizza")){
      Logger.log("si")
      break
    }
    else{
      Logger.log("no hay")
    }
  }
}
