const theftBlocks = (args) => {
   return `
   <div class="cell border-box-sizing code_cell rendered celltag_remove_input">
   <div class="output_wrapper">
     <div class='boxWrapper' id='summary_issue'>
         <div class='boxInnerWrapper'>
           <div class='box boxColor1'>
               <div class='info'>$534B</div>
               <div class='infoLabel'>Stolen in 2020</div>
           </div>
           <div class='box boxColor3'>
               <div class='info'>$4T</div>
               <div class='infoLabel'>Stolen in 19 years<br />from 2002 to 2020</div>
           </div>
         </div>
     </div>
     <p style="font-size: 7pt; font-family: Poppins; text-align: center;">* based on US population of
         329880000 for 2020
     </p>
   </div>
</div>`
}
module.exports = theftBlocks