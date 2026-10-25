import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const file=new URL('../android/app/debug.keystore',import.meta.url);
if(!existsSync(file))execFileSync('keytool',['-genkeypair','-v','-storetype','PKCS12','-keystore',file.pathname,'-storepass','android','-alias','androiddebugkey','-keypass','android','-keyalg','RSA','-keysize','2048','-validity','10000','-dname','CN=Android Debug,O=Android,C=US'],{stdio:'inherit'});
