import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

console.log(process.env.MAIL_USER);
console.log(process.env.MAIL_PASS.length);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

export async function sendMail(subject,text){

await transporter.sendMail({
from:process.env.MAIL_USER,
to:"info@awaduya.com",
subject,
text,
});

console.log("メール送信成功");

}