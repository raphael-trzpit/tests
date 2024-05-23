import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import { Client } from 'pg';
import Joi from 'joi';

// Configuration de la base de données
const dbConfig = {
    user: 'user',
    host: 'localhost',
    database: 'mydatabase',
    password: 'password',
    port: 5432,
};

// Initialisation du client PostgreSQL
const client = new Client(dbConfig);

client.connect()
    .then(() => console.log('Connected to database'))
    .catch(err => {
        console.error('Database connection error', err);
        process.exit(1);
    });

// Initialisation de l'application Express
const app = express();
const port = 3000;

app.use(bodyParser.json());

// Middleware pour la gestion des erreurs
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

// Schéma de validation pour les utilisateurs
const userSchema = Joi.object({
    name: Joi.string().min(3).required(),
    email: Joi.string().email().required(),
    age: Joi.number().integer().min(0).optional(),
});

// Fonction pour récupérer tous les utilisateurs
app.get('/users', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await client.query('SELECT * FROM users');
        res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

// Fonction pour récupérer un utilisateur par ID
app.get('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params.id;
    try {
        const result = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// Fonction pour créer un nouvel utilisateur
app.post('/users', async (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = userSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    const { name, email, age } = value;
    try {
        const result = await client.query(
            'INSERT INTO users (name, email, age) VALUES ($1, $2, $3) RETURNING *',
            [name, email, age]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// Fonction pour mettre à jour un utilisateur par ID
app.put('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params.id;
    const { error, value } = userSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    const { name, email, age } = value;
    try {
        const result = await client.query(
            'UPDATE users SET name = $1, email = $2, age = $3 WHERE id = $4 RETURNING *',
            [name, email, age, userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// Fonction pour supprimer un utilisateur par ID
app.delete('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params.id;
    try {
        const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING *', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        next(error);
    }
});

// Démarrage du serveur
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
