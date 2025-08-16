const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// -------------------- MIDDLEWARE --------------------
app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL || '*', // fallback to * if env missing
  methods: ['GET', 'POST'],
}));

app.use(express.json());

// -------------------- RATE LIMIT --------------------
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: { error: "Too many requests, please try again later." },
});
app.use('/api/', apiLimiter);

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: "Too many appointment requests from this IP, try again later." },
});

// -------------------- ROUTES --------------------
app.get('/api/reviews', async (req, res) => {
  try {
    const placeId = process.env.GOOGLE_PLACE_ID;
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!placeId || !apiKey) {
      return res.status(500).json({ error: 'Google API credentials are missing.' });
    }

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&language=el&key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(500).json({ error: 'Failed to fetch reviews from Google API.' });
    }

    const data = await response.json();
    res.json({ reviews: data.result?.reviews || [] });
  } catch (err) {
    console.error('Reviews route error:', err);
    res.status(500).json({ error: 'Internal Server Error.' });
  }
});

app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, email, phone, hours, date } = req.body;

  if (!name || !email || !phone || !hours || !date) {
    return res.status(400).json({ error: "All fields are required." });
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return res.status(500).json({ error: "Email service not configured." });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const emailBody = `
      <h3>New Appointment Request</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Hours:</strong> ${hours}</p>
      <p><strong>Date:</strong> ${date}</p>
    `;

    await transporter.sendMail({
      from: `"${name}" <${email}>`,
      to: process.env.EMAIL_USER,
      subject: `Appointment Request from ${name}`,
      text: `New appointment request:\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nHours: ${hours}\nDate: ${date}`,
      html: emailBody,
    });

    res.status(200).json({ success: true, message: "Message sent successfully!" });
  } catch (err) {
    console.error('Contact route error:', err);
    res.status(500).json({ error: "Failed to send message." });
  }
});

// -------------------- VERCEL EXPORT --------------------
module.exports = app;
