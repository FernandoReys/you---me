import {createApp} from '../server.js';
let application;
export default async function handler(req,res){
 try{application||=createApp().app;return application(req,res)}catch(error){console.error('Application configuration:',error.message);return res.status(503).json({error:'O banco de dados precisa ser configurado antes de utilizar o app.'})}
}
