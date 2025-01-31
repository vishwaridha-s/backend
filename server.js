require('dotenv').config();
const bcrypt = require('bcryptjs');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');

const app = express();
const port = 5000;
const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret';

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
const url = process.env.MONGO_URI;
const dbName = 'brillia';
const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });

client.connect().then(() => {
  console.log('Connected to MongoDB Atlas');
}).catch((err) => {
  console.error('MongoDB Connection Error:', err);
});

// Signup Route
app.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const db = client.db(dbName);
    const usersCollection = db.collection('users');

    const userExists = await usersCollection.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await usersCollection.insertOne({ email, password: hashedPassword });

    res.status(201).json({ success: true, message: 'User created successfully' });
  } catch (error) {
    console.error('Signup Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Login Route
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const db = client.db(dbName);
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    const token = jwt.sign({ email: user.email }, jwtSecret, { expiresIn: '1h' });
    res.json({ success: true, message: 'Login successful', token });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

app.post("/update-progress", async (req, res) => {
  try {
    const { userId, courseId, lessonId, completed } = req.body;

    if (!userId || !courseId || !lessonId || completed === undefined) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const db = client.db(dbName);
    const progressCollection = db.collection("user_progress");

    // Update or insert lesson progress
    const existingProgress = await progressCollection.findOne({ userId, courseId, lessonId });

    if (existingProgress) {
      await progressCollection.updateOne(
        { userId, courseId, lessonId },
        { $set: { completed } }
      );
    } else {
      await progressCollection.insertOne({ userId, courseId, lessonId, completed });
    }
    const totalLessons = 4;
    const completedLessons = await progressCollection.countDocuments({ userId, courseId, completed: true });
    const progressPercentage = Math.round((completedLessons / totalLessons) * 100);

    await progressCollection.updateOne(
      { userId, courseId, isCourseProgress: true },
      { $set: { progressPercentage } },
      { upsert: true }
    );

    res.json({ success: true, message: "Progress updated successfully", progressPercentage });
  } catch (error) {
    console.error("Error updating progress:", error);
    res.status(500).json({ success: false, message: "Error updating progress", error });
  }
});
app.get("/get-progress", async (req, res) => {
  try {
    const { userId, courseId } = req.query;

    if (!userId || !courseId) {
      return res.status(400).json({ success: false, message: 'User ID and Course ID are required' });
    }

    const db = client.db(dbName);
    const progressCollection = db.collection("user_progress");

    const progress = await progressCollection.find({ userId, courseId, lessonId: { $exists: true } }).toArray();
    const courseProgress = await progressCollection.findOne({ userId, courseId, isCourseProgress: true });

    res.json({ 
      success: true, 
      progress, 
      progressPercentage: courseProgress ? courseProgress.progressPercentage : 0 
    });
  } catch (error) {
    console.error("❌ Error fetching progress:", error);
    res.status(500).json({ success: false, message: "Error fetching progress", error });
  }
});

const courseContent = {
  1: [
    { id: 1, title: "Introduction to HTML", content: "HTML (HyperText Markup Language) is the standard language for creating web pages. It describes the structure of a web page using markup. HTML elements are the building blocks of HTML pages." },
    { id: 2, title: "HTML Elements", content: "HTML elements are represented by tags, and they form the structure of a web page. Some common HTML elements include headings (`<h1>` to `<h6>`), paragraphs (`<p>`), links (`<a>`), images (`<img>`), lists (`<ul>`, `<ol>`, and `<li>`), and tables (`<table>`)." },
    { id: 3, title: "HTML Attributes", content: "HTML attributes provide additional information about HTML elements. They are always included in the opening tag and usually come in name/value pairs like `name='value'`. Common attributes include `href` for links, `src` for images, and `alt` for alternative text for images." },
    { id: 4, title: "HTML Forms", content: "HTML forms are used to collect user input. Form elements include text fields, checkboxes, radio buttons, and submit buttons. The `<form>` element wraps these elements and specifies the action URL where the data should be sent." },
  ],
  2: [
    { id: 1, title: "Introduction to CSS", content: "CSS (Cascading Style Sheets) is used to control the style and layout of web pages. CSS allows you to apply styles to HTML elements, including setting colors, fonts, and spacing." },
    { id: 2, title: "CSS Selectors", content: "CSS selectors are used to select HTML elements to apply styles to them. Common selectors include element selectors (e.g., `p`), class selectors (e.g., `.class-name`), and ID selectors (e.g., `#id-name`)." },
    { id: 3, title: "CSS Box Model", content: "The CSS box model describes the layout of elements on a web page. Each element is represented as a rectangular box, consisting of margins, borders, padding, and the content area. Understanding the box model is crucial for designing web page layouts." },
    { id: 4, title: "CSS Flexbox", content: "Flexbox (Flexible Box Layout) is a CSS layout model that provides a more efficient way to lay out, align, and distribute space among items in a container. It allows you to create flexible and responsive designs by controlling the positioning of elements." },
  ],
  3: [
    { id: 1, title: "Introduction to JavaScript", content: "JavaScript is a versatile programming language that allows you to add interactivity and dynamic behavior to web pages. It can be used to create responsive user interfaces, validate forms, and manipulate the DOM (Document Object Model)." },
    { id: 2, title: "JavaScript Variables and Data Types", content: "JavaScript variables are used to store data values. Variables can hold different data types, including numbers, strings, booleans, arrays, and objects. You can declare variables using `var`, `let`, or `const`." },
    { id: 3, title: "JavaScript Functions", content: "JavaScript functions are blocks of code designed to perform a particular task. They are executed when called (invoked). Functions can accept parameters and return values. You can define functions using the `function` keyword." },
    { id: 4, title: "JavaScript Events", content: "JavaScript events are actions or occurrences that happen in the browser, such as clicks, key presses, and form submissions. You can use event listeners to execute code in response to these events. Common event types include `click`, `keydown`, and `submit`." },
  ],
  4:[
    { id: 1, title: "React Components", content: "A class component must include the extends React.Component statement. This statement creates an inheritance to React.Component, and gives your component access to React.Component's functions." },
    { id: 2, title: "React Class Components", content: "Components are independent and reusable bits of code. They serve the same purpose as JavaScript functions, but work in isolation and return HTML via a render() function. Components come in two types, Class components and Function components, in this chapter you will learn about Class components." },
    { id: 3, title: "React useEffect Hooks", content: "The useEffect Hook allows you to perform side effects in your components. Some examples of side effects are: fetching data, directly updating the DOM, and timers. useEffect accepts two arguments. The second argument is optional. useEffect(<function>, <dependency>)" },
    { id: 4, title: "React useContext Hook", content: "React Context is a way to manage state globally. It can be used together with the useState Hook to share state between deeply nested components more easily than with useState alone."}
  ]
};

app.get('/get-course-content', (req, res) => {
  const courseId = req.query.courseId;
  const lessons = courseContent[courseId];

  if (lessons) {
    res.json({ success: true, lessons });
  } else {
    res.json({ success: false, message: 'Course not found' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});