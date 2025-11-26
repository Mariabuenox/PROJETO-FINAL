const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = 8000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


const db = new sqlite3.Database("campanhas.db");
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS cadastro ( id INTEGER PRIMARY KEY AUTOINCREMENT, nome_completo TEXT, email TEXT,senha TEXT,confirmar_senha TEXT, tipo TEXT)" );
    db.run("CREATE TABLE IF NOT EXISTS doar_alimento (item INT, quantidade INT, data DATE, codigo_sala TEXT, docente TEXT, pontuacao_total INT)");
    db.run("CREATE TABLE IF NOT EXISTS doar_pet (item INT, quantidade INT, data DATE, codigo_sala TEXT, docente TEXT, pontuacao_total INT)");
    db.run("CREATE TABLE IF NOT EXISTS doar_agasalho (item INT, quantidade INT, data DATE, codigo_sala TEXT, docente TEXT, pontuacao_total INT)");
    db.run("CREATE TABLE IF NOT EXISTS doar_brinquedo (item INT, quantidade INT, data DATE, codigo_sala TEXT, docente TEXT, pontuacao_total INT)");

});

// Configuração
app.use('/static', express.static(__dirname + '/static'));


app.use(session({
    secret: 'segredo-secreto',
    resave: false,
    saveUninitialized: true
}));

app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
function autenticado(req, res, next) {
    if (req.session.loggedin) {
      next(); // continua para a próxima função (a rota)
    } else {
      res.redirect('/login?mensagem=Faça login para continuar');
    }
  }
  

// Rota inicial
app.get("/", (req, res) => {
    const nome = req.session?.UsuarioLogado || null;

    res.render("pages/index", { 
        nome, 
        req 
    });

    console.log("Nome da Sessão:", req.session?.UsuarioLogado);
});


app.get("/cadastro", (req, res) => {
    res.render("pages/cadastro", {req});
})

app.post("/cadastro", (req, res) => {
    console.log("POST /cadastro");
    console.log(JSON.stringify(req.body));

    const { nome_completo, email, senha, confirmar_senha, tipo } = req.body;

    if (!nome_completo || !email || !senha || !confirmar_senha || !tipo) {
        return res.redirect("/cadastro?mensagem=Preencha todos os campos");
    }
    if (senha !== confirmar_senha) {
        return res.redirect("/cadastro?mensagem=As senhas não são iguais");
    }
    const insertQuery = "INSERT INTO cadastro (nome_completo, email, senha, tipo) VALUES (?, ?, ?, ?)";
    db.run(insertQuery, [nome_completo, email, senha, tipo], function (err) {
        if (err) throw err;
        console.log("Novo usuário cadastrado:", nome_completo);
        return res.redirect("/cadastro?mensagem=Cadastro efetuado com sucesso");
    })
})

// Página de login
app.get("/login", (req, res) => {
    const mensagem = req.query.mensagem || "";
    res.render("pages/login", {mensagem, req});
});

// Login POST
app.post("/login", (req, res) => {
    console.log("POST /login");
    console.log(JSON.stringify(req.body));

    const { email, senha} = req.body;

    if (!email || !senha) {
        return res.redirect("/login?mnsagem=Preencha todos oc campos");
    }

    const query = "SELECT * FROM cadastro WHERE email=? AND senha=?";
    db.get(query, [email, senha], (err, row) => {
        if (err) throw err;

        console.log(`row: ${JSON.stringify(row)}`);
        if (row) {
            req.session.loggedin = true;
            req.session.email = row.email;
            req.session.id_usuario = row.id;
            req.session.DocenteLogado = row.tipo === 'Docente';
            req.session.UsuarioLogado = row.nome_completo;
            res.redirect("/");
        } else {
            res.redirect("/login?mensagem=Usuário ou senha  inválidos");

        }
    });
});

app.get("/ranking", (req, res) => {
    console.log("GET /ranking");

    const query = `
        SELECT 
            codigo_sala,
            SUM(COALESCE(pontuacao_total, 0)) AS pontuacao
        FROM (
            SELECT codigo_sala, pontuacao_total FROM doar_alimento
            UNION ALL
            SELECT codigo_sala, pontuacao_total FROM doar_pet
            UNION ALL
            SELECT codigo_sala, pontuacao_total FROM doar_agasalho
            UNION ALL
            SELECT codigo_sala, pontuacao_total FROM doar_brinquedo
        )
        GROUP BY codigo_sala
        ORDER BY pontuacao DESC;
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("Erro no ranking:", err);
            return res.status(500).render("pages/ranking", {
                titulo: "Ranking das Turmas",
                dados: [],
                erro: "Erro ao consultar ranking",
                req
            });
        }

        console.log("RANKING:", rows);

        res.render("pages/ranking", {
            titulo: "Ranking das Turmas",
            dados: rows,
            req
        });
    });
});


app.get("/confirmar", (req, res) => {
    res.render("pages/confirmar", { titulo: "CONFIRMAÇÃO", req });
});

app.get("/info", (req, res) => {
    console.log("GET/ info")
    res.render("pages/info", {req});
});

app.get("/doar_alimento", autenticado, (req, res) => {
    res.render("pages/doar_alimento", {req});
});

app.post("/doar_alimento", autenticado, (req, res) => {
    const { item, quantidade, data, codigo_sala, docente } = req.body;
    const pontuacao_total = item * quantidade;

    db.run(
        "INSERT INTO doar_alimento (item, quantidade, data, codigo_sala, docente, pontuacao_total) VALUES (?, ?, ?, ?, ?, ?)",
        [item, quantidade, data, codigo_sala, docente, pontuacao_total],
        () => res.redirect("/agradecimento")
    );
});

app.get("/doar_pet", autenticado, (req, res) => {
    res.render("pages/doar_pet", {req});
});

app.post("/doar_pet", autenticado, (req, res) => {
    const { item, quantidade, data, codigo_sala, docente } = req.body;
    const pontuacao_total = item * quantidade;

    db.run(
        "INSERT INTO doar_pet (item, quantidade, data, codigo_sala, docente, pontuacao_total) VALUES (?, ?, ?, ?, ?, ?)",
        [item, quantidade, data, codigo_sala, docente, pontuacao_total],
        () => res.redirect("/agradecimento")
    );
});

app.get("/doar_agasalho", autenticado, (req, res) => {
    res.render("pages/doar_agasalho", {req});
});

app.post("/doar_agasalho", autenticado, (req, res) => {
    const { item, quantidade, data, codigo_sala, docente } = req.body;
    const pontuacao_total = item * quantidade;

    db.run(
        "INSERT INTO doar_agasalho (item, quantidade, data, codigo_sala, docente, pontuacao_total) VALUES (?, ?, ?, ?, ?, ?)",
        [item, quantidade, data, codigo_sala, docente, pontuacao_total],
        () => res.redirect("/agradecimento")
    );
});

app.get("/doar_brinquedo", autenticado, (req, res) => {
    res.render("pages/doar_brinquedo", {req});
});

app.post("/doar_brinquedo", autenticado, (req, res) => {
    const { item, quantidade, data, codigo_sala, docente } = req.body;
    const pontuacao_total = item * quantidade;

    db.run(
        "INSERT INTO doar_brinquedo (item, quantidade, data, codigo_sala, docente, pontuacao_total) VALUES (?, ?, ?, ?, ?, ?)",
        [item, quantidade, data, codigo_sala, docente, pontuacao_total],
        () => res.redirect("/agradecimento")
    );
});

app.get("/agradecimento", (req, res) => {
    console.log("GET /agradecimento")
    res.render("pages/agradecimento", {req});
});

app.get("/doar_novamente", (req, res) => {
    console.log("GET /doar_novamente")
    res.render("pages/doar_novamente", { req });
});


app.get("/post-create", (req, res) => {
    if (!req.session.loggedin) {
        return res.redirect("/erro");
    }
    res.render("pages/post-create", { req });
});


app.post("/post-create", (req, res) => {
    console.log("POST /post-create");

    if (!req.session.loggedin) {
        return res.redirect("/erro");
    }

    const { item_doado, quantidade, codigo_sala, docente } = req.body;

    const pontuacao_final = Number(item_doado) * Number(quantidade);

    const data_criacao = new Date().toLocaleDateString("pt-BR");

    const query = `
        INSERT INTO posts 
        (item_doado, quantidade, data, codigo_sala, docente, id_usuario, pontuacao_final)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(
        query,
        [
            item_doado,
            quantidade,
            data_criacao,
            codigo_sala,
            docente,
            req.session.id_usuario,
            pontuacao_final
        ],
        function(err) {
            if (err) {
                console.error("Erro ao inserir post:", err);
                return res.redirect("/erro");
            }
            res.redirect("/post-tabela");
        }
    );
});


app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log("Erro ao destruir sessão:", err);
            return res.redirect("/");
        }
        res.clearCookie("connect.sid");
        res.redirect("/login?mensagem=Você saiu da conta");
    });
});


app.get("/post-tabela", (req, res) => {
    const query = "SELECT * FROM posts";
    db.all(query, [], (err, rows) => {
        if (err) throw err;

        res.render("pages/post-tabela", { 
            titulo: "TABELA DE DOAÇÃO", 
            dados: rows, 
            req 
        });
    });
});

// Rota de erro 404
app.use((req, res) => {
    res.status(404).render("pages/erro", { 
        titulo: "ERRO 404", 
        req, 
        msg: "404" 
    });
});


// Inicializa o servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});

