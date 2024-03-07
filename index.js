import express from "express";
import bodyParser  from "body-parser";
import pg from "pg";
import axios from "axios";
//https://www.vinzius.com/post/free-and-paid-api-isbn/ get books by isbn

const app = express();
const port = process.env.PORT || 3000;
const { Pool } = pg;

const connectionString = process.env.DB_URL;
 
const db = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false,
  }
});
db.connect();


let reviews = [];

async function getReviews() {
    const results = await db.query("SELECT * FROM reviews");
    reviews = results.rows;
}


app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"))

app.get("/", async(req, res) => {
    await getReviews();
    res.render("index.ejs", {reviews: reviews});
});

app.post("/edit", (req, res) => {
    const id = req.body.id;
    const target = reviews.find(review => review.id == id);
    console.log(target.id);
    res.render("edit.ejs", {review: target});
});

app.post("/update", async (req, res) => {
    const id = req.body.id;
    const text = req.body.text;
    const rating = req.body.rating;
    const password = req.body.password;
    const target = reviews.find(review => review.id == id);
    if (target.pass === password) {
        await db.query("UPDATE reviews SET review=$1, rating=$2 WHERE id=$3", [text, rating, id]);
        res.redirect("/");
    } else {
        console.log(password);
        console.log(target.pass);
        res.render("edit.ejs", {review: target, error: "Incorrect Password"});
    }
});

app.post("/add", (req, res) => {
    res.render("add.ejs");
}); 

app.post("/create" , async(req, res) => {
    const isbn = req.body.isbn;
    try {
        const results = await axios.get(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=details&format=json`);
        console.log(Object.keys(results.data).length);
        if (Object.keys(results.data).length === 0) {
            res.render("add.ejs", {err: "No books with provided ISBN found"});
        } else {
            // details about book 
            const details = results.data[`ISBN:${isbn}`].details;
            console.log(details);

            const text = req.body.text;
            const rating = req.body.rating;
            const password = req.body.password;
            const pubDate = new Date(details.publish_date).toJSON().slice(0, 10);
            const title = details.title;
            try {
                await db.query("INSERT INTO reviews (isbn, rating, review, pub, title, pass) VALUES ($1, $2, $3, $4, $5, $6)", [isbn, rating, text, pubDate, title, password]);
                res.redirect("/"); 
            } catch(err) {
                res.render("add.ejs", {err: err});
            }

        }
    } catch (err) {
        console.log(err);
        res.render("add.ejs", {err: err});
    }
    
});

app.post("/delete", async(req, res) => {
    const id = req.body.id;
    const password = req.body.password;
    const target = reviews.find(review => review.id == id);
    if (password === target.pass) {
        await db.query("DELETE FROM reviews WHERE id=$1", [id]);
    }
    res.redirect("/");
});

app.post("/sort", async (req, res) => {
    const sort = req.body.sort;
    let results;
    if (reviews.length > 0) {
        switch(sort) {
            case "desc":
                results = await db.query("SELECT * FROM reviews ORDER BY rating DESC");
                break;
            case "asc":
                results = await db.query("SELECT * FROM reviews ORDER BY rating ASC");
                break;
            case "recent":
                results = await db.query("SELECT * FROM reviews ORDER BY pub DESC");
                break;        
            case "oldest":
                results = await db.query("SELECT * FROM reviews ORDER BY pub ASC");
                break;     
        }
        reviews = results.rows;
        res.render("index.ejs", {reviews: reviews});
    } else {
        res.redirect("/");
    }

});
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
