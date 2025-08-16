import express from 'express';
import cors from "cors";
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import nodemailer from "nodemailer";
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
dotenv.config();
const app = express();
// const PORT = process.env.PORT || 3000;
app.use(helmet());
app.use(cors({
  origin: `${process.env.FRONTEND_URL}`, // Frontend url
  methods: ["GET", "POST"],
}));
app.use(express.json());
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each Ip to 50 requests per windowMs
  message: {
    error: "Too many requests, please try again later.",
  },
})
app.use("/api/", apiLimiter);
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // max 5 requests per hour per IP
  message: {
    error: "Too many appointment requests from this IP, try again later.",
  },
})
app.get('/api/reviews', async (req, res) => {
  try {
    const placeId = process.env.GOOGLE_PLACE_ID;
    const apiKey = process.env.GOOGLE_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&language=el&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json({ reviews: data.result.reviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});
app.post("/api/contact", contactLimiter, async (req, res) => {
  const { name, email, phone, hours, date } = req.body;

  console.log("Received contact form submission:", { name, email, phone, hours, date });

  // Basic validation
  if (!name || !email || !phone || !hours || !date) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail", // or "hotmail", "yahoo", etc.
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
      to: process.env.EMAIL_USER, // your inbox
      subject: `Appointment Request from ${name}`,
      text: `New appointment request:\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nHours: ${hours}\nDate: ${date}`,
      html: emailBody,
    });

    res.status(200).json({ success: true, message: "Message sent successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to send message." });
  }
});

// Local Mode

// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });

// Production Mode
export default app;