const path = require('node:path');
const { spawnSync } = require('node:child_process');
module.exports = async context => {
  if(context.electronPlatformName!=='win32')return;
  const executable=path.join(context.appOutDir,'CV Atelier.exe');
  const result=spawnSync(require.resolve('electron-winstaller/vendor/rcedit.exe'),[executable,'--set-icon',path.join(__dirname,'icon.ico'),'--set-version-string','ProductName','CV Atelier','--set-version-string','FileDescription','CV Atelier offline CV editor','--set-file-version','1.0.0','--set-product-version','1.0.0'],{stdio:'inherit'});
  if(result.status!==0)throw Error('Windows executable resources could not be updated.');
};
