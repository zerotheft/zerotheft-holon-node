const head = (args) => {
  return `<!DOCTYPE html>
  <html>
     <head>
        <meta charset="utf-8" />
        <title>ztReport</title>
        <style>
           @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@100;200;300;400;500;600;700;800;900&display=swap');
           body {
           max-width: 1200px;
           margin: 0 auto;
           }
           #notebook-container {
           padding: 15px;
           background-color: #fff;
           min-height: 0;
           }
           div.cell {
           display: -webkit-box;
           -webkit-box-orient: vertical;
           -webkit-box-align: stretch;
           display: -moz-box;
           -moz-box-orient: vertical;
           -moz-box-align: stretch;
           display: box;
           box-orient: vertical;
           box-align: stretch;
           display: flex;
           flex-direction: column;
           align-items: stretch;
           border-radius: 2px;
           box-sizing: border-box;
           -moz-box-sizing: border-box;
           -webkit-box-sizing: border-box;
           border-width: 1px;
           border-style: solid;
           border-color: transparent;
           width: 100%;
           padding: 5px;
           margin: 0px;
           outline: none;
           position: relative;
           overflow: visible;
           }
           .header {
           background: #7336A3 !important;
           color: #F2F2F2;
           font-family: Poppins;
           display: flex;
           flex-direction: row;
           justify-content: space-between;
           align-items: center;
           padding: 0 40px;
           }
           .download {
           float: right;
           text-decoration: none
           }
           .userDiv {
           border: solid 1px;
           background: #F2F2F2;
           text-align: center;
           }
           .title {
           width: 100%;
           font-family: Poppins;
           font-weight: bold;
           font-size: 29px;
           line-height: 43px;
           letter-spacing: -0.015em;
           color: #7F51C1;
           }
           .yesDiv {
           font-size: 22px;
           line-height: 26px;
           color: green;
           }
           .noDiv {
           font-size: 22px;
           line-height: 26px;
           color: red;
           }
           .btn {
           font-family: Poppins;
           background-color: #7336A3;
           border: none;
           border-radius: 8px;
           color: white;
           padding: 12px 20px;
           cursor: pointer;
           font-size: 16px;
           }
           .btn>svg {
           width: 20px;
           }
           .btn:hover {
           color: #7F51C1;
           border: 2px solid #7F51C1;
           border-radius: 8px;
           background-color: white;
           padding: 10px 18px;
           }
           .box {
           box-shadow: 0px 4px 23px rgba(0, 0, 0, 0.08);
           border-radius: 8px;
           height: 140px;
           width: 260px;
           margin: 20px;
           }
           .boxColor1 {
           background: #EBD7F9 !important;
           }
           .boxColor2 {
           background: #C5EEE4;
           !important;
           }
           .boxColor3 {
           background: #EEE5C5;
           !important;
           }
           .boxColor4 {
           background: #C5EEE4;
           !important;
           }
           .info {
           font-family: Poppins;
           font-weight: bold;
           font-size: 48px;
           line-height: 72px;
           letter-spacing: -0.06em;
           padding: 20px 20px;
           }
           .infoLabel {
           font-family: Poppins;
           font-weight: 500;
           font-size: 14px;
           line-height: 21px;
           padding: 20px 20px;
           margin: -40px 0;
           }
           .boxWrapper {
           display: flex;
           justify-content: space-around;
           min-width: 565px;
           width: 100%;
           }
           .boxInnerWrapper {
           display: flex;
           flex-direction: row;
           }
           @media (max-width: 1200px) {
           .info {
           font-size: 32px;
           line-height: 42px;
           }
           .infoLabel {
           font-size: 11px;
           line-height: 12px;
           }
           .box {
           height: 100px;
           width: 200px;
           }
           .boxWrapper {
           padding: 0 10px;
           }
           }
        </style>
     </head>
     <body>
     <div tabindex="-1" id="notebook" class="border-box-sizing">
     <div class="container" id="notebook-container">`
}
module.exports = head