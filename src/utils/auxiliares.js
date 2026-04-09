const fs = require('fs');
const path = require('path');
const dotenv = require("dotenv");

// nodemailer se usa para enviar correos
let nodemailer;
try { nodemailer = require('nodemailer'); } catch (e) { nodemailer = null; }

/**
 * Envia un PDF por correo usando SMTP (por ejemplo Gmail SMTP).
 * Requiere configurar las variables de entorno EMAIL_USER y EMAIL_PASS (o SMTP_HOST/PORT/SECURE opcionales).
 *
 * Opciones:
 *  - to: destinatario (string o lista)
 *  - subject: asunto
 *  - text: texto plano del correo
 *  - filename: nombre del adjunto (por defecto 'reporte.pdf')
 *  - pdfBuffer: Buffer con el PDF (requerido)
 *  - from: remitente (opcional, por defecto EMAIL_USER)
 *
 * Retorna la promesa de nodemailer.sendMail
 * para obtener PSS para tu aplicacion visita: https://support.google.com/mail/?p=InvalidSecondFactor
 */
async function sendPdfReport({ to, subject = 'Reporte PDF', text = '', filename = 'reporte.pdf', pdfBuffer, from }){
	if (!pdfBuffer) throw new Error('pdfBuffer (Buffer) es requerido');
	if (!nodemailer) throw new Error('nodemailer no está instalado. Ejecuta: npm install nodemailer');

	const host = process.env.SMTP_HOST || 'smtp.gmail.com';
	const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;
	const secure = (process.env.SMTP_SECURE !== undefined) ? (String(process.env.SMTP_SECURE) === 'true') : true;
	const user = process.env.EMAIL_USER;
	const pass = process.env.EMAIL_PASS;

	if (!user || !pass) {
		throw new Error('Variables de entorno EMAIL_USER y EMAIL_PASS necesarias para autenticación SMTP');
	}

	const transporter = nodemailer.createTransport({
		host,
		port,
		secure,
		auth: { user, pass }
	});

	const mailOptions = {
		from: from || user,
		to,
		subject,
		text,
		attachments: [
			{ filename, content: pdfBuffer, contentType: 'application/pdf' }
		]
	};

	return transporter.sendMail(mailOptions);
}

module.exports = { sendPdfReport };
