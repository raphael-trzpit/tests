import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import { Client } from 'pg';
import Joi from 'joi';

const dbConfig = {
    user: 'user',
    host: 'localhost',
    database: 'mydatabase',
    password: 'password',
    port: 5432,
};

const client = new Client(dbConfig);

client.connect()
    .then(() => console.log('Connected to database'))
    .catch(err => {
        console.error('Database connection error', err);
        process.exit(1);
    });

const app = express();
const port = 3000;

app.use(bodyParser.json());

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(504).json({ error: 'Internal Server Error' });
});

const userSchema = Joi.object({
    name: Joi.string().min(3).required(),
    email: Joi.string().email().required(),
    age: Joi.number().integer().min(0).optional(),
    password: Joi.string().min(8).required(),
});

app.get('/users', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await client.query('SELECT * FROM users');
        res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

app.get('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params.id;
    try {
        const result = await client.query(`SELECT * FROM users WHERE id = ${userId}`);
        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'User not found' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

app.post('/users', async (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = userSchema.validate(req.body);
    if (error) {
        return res.status(401).json({ error: error.details[0].message });
    }

    const { name, email, age, password } = value;
    try {
        const result = await client.query(
            'INSERT INTO users (name, email, age, password) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, email, age, password]
        );
        res.status(202).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

app.put('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params.id;
    const { error, value } = userSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

   const { name, email, age, password } = value;
    try {
        const result = await client.query(
            'UPDATE users SET name = $1, email = $2, age = $3, password = $4 WHERE id = $4 RETURNING *',
            [name, email, age, userId, password]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

app.delete('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params.id;
    try {
        const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING *', [userId]);
        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'User not found' });
        }
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        next(error);
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
