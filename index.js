
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Aki } = require('aki-api');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações
app.use(cors());
app.use(express.json());

const sessions = new Map();

const ANSWERS = {
    1: 0,
    2: 1,
    3: 2,
    4: 3,
    5: 4,
    yes: 0,
    no: 1,
    dontKnow: 2,
    probably: 3,
    probablyNot: 4
};

// Formatar resposta
function formatGame(id, aki) {
    const finished = Boolean(aki.isWin);

    return {
        success: true,
        id,
        question: finished ? null : aki.question,
        answers: [
            'Sim',
            'Não',
            'Não sei',
            'Provavelmente',
            'Provavelmente não'
        ],
        progress: Number(aki.progress || 0),
        finished,
        guess: finished ? {
            name: aki.sugestion_name || 'Personagem',
            description: aki.sugestion_desc || '',
            photo: aki.sugestion_photo || null
        } : null
    };
}

// Página inicial
app.get('/', (req, res) => {
    res.json({
        name: 'Albino Akinator API',
        creator: 'Albino Modz',
        status: 'online',
        version: '1.0.0',
        endpoints: {
            start: 'POST /start',
            answer: 'POST /answer',
            stop: 'DELETE /session/:id',
            health: 'GET /health'
        }
    });
});

// Status da API
app.get('/health', (req, res) => {
    res.json({
        success: true,
        online: true,
        activeGames: sessions.size
    });
});

// Iniciar jogo
app.post('/start', async (req, res) => {
    try {
        const region = String(
            req.body.lang || 'pt'
        ).toLowerCase();

        const allowed = [
            'pt', 'en', 'es', 'fr',
            'de', 'it', 'ru', 'tr',
            'ar', 'jp', 'kr', 'nl'
        ];

        if (!allowed.includes(region)) {
            return res.status(400).json({
                success: false,
                error: 'Idioma não suportado'
            });
        }

        const aki = new Aki({
            region,
            childMode: req.body.childMode === true
        });

        await aki.start();

        const id = crypto.randomUUID();

        sessions.set(id, {
            aki,
            createdAt: Date.now()
        });

        return res.json(formatGame(id, aki));

    } catch (error) {
        console.error('[AKINATOR START]', error);

        return res.status(500).json({
            success: false,
            error: 'Erro ao iniciar partida',
            details: error.message
        });
    }
});

// Responder pergunta
app.post('/answer', async (req, res) => {
    try {
        const { id, answer } = req.body;

        if (!id || answer === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Informe id e answer'
            });
        }

        const session = sessions.get(id);

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Partida não encontrada ou encerrada'
            });
        }

        const answerIndex = ANSWERS[
            String(answer).trim()
        ];

        if (answerIndex === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Resposta inválida',
                accepted: [1, 2, 3, 4, 5]
            });
        }

        const aki = session.aki;

        await aki.step(answerIndex);

        const result = formatGame(id, aki);

        if (result.finished) {
            sessions.delete(id);
        }

        return res.json(result);

    } catch (error) {
        console.error('[AKINATOR ANSWER]', error);

        return res.status(500).json({
            success: false,
            error: 'Erro ao responder pergunta',
            details: error.message
        });
    }
});

// Encerrar partida
app.delete('/session/:id', (req, res) => {
    const deleted = sessions.delete(req.params.id);

    return res.json({
        success: deleted,
        message: deleted
            ? 'Partida encerrada'
            : 'Partida não encontrada'
    });
});

// Limpeza automática de partidas antigas
setInterval(() => {
    const expiration = Date.now() - 2 * 60 * 60 * 1000;

    for (const [id, session] of sessions) {
        if (session.createdAt < expiration) {
            sessions.delete(id);
        }
    }
}, 10 * 60 * 1000).unref();

// Inicialização
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃    ALBINO AKINATOR API     ┃
┃                            ┃
┃    Status: ONLINE          ┃
┃    Porta: ${PORT}             
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
    `);
});
