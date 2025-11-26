const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = 8000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Conexão com o BD
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
    const nome = req.session.UsuarioLogado;
    res.render("pages/index", { nome, req});
    console.log("Nome da Sessão:", req.session.UsuarioLogado);
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


// Demais rotas
app.get("/confirmar", (req, res) => {
    res.render("pages/confirmar", { titulo: "CONFIRMAÇÃO", req });
});

app.get("/info", (req, res) => {
    console.log("GET/ info")
    res.render("pages/info", {req});
});

// ------------------ ALIMENTOS ------------------
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

// ------------------ PET ------------------
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

// ------------------ AGASALHO ------------------
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

// ------------------ BRINQUEDO ------------------
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
app.get("/post-create", (req, res) => {
    console.log("GET /post-create");
    //verificar se o usuário está logado
    //se estiver logado, envie o formulário para a criação do post
    if (req.session.loggedin) {
        res.render("pages/post-create", { titulo: "Criar postagem", req: req })
    } else {  // se não estiver logado, redirect para /nao-autorizado
        res.redirect("/erro")
    }

});

app.post("/post-create", (req, res) => {
    console.log("POST /post-create");
    //Pegar dados da postagem: UserID, Titulo Postagem, Conteúdo da postagem, Data da postagem

    //req.session.username, req.session.id_username
    if (req.session.loggedin) {
        console.log("Dados da postagem: ", req.body);
        const { titulo, conteudo } = req.body;
        const data_criacao = new Date();
        const data = data_criacao.toLocaleDateString();
        console.log("Data da criação:", data, "Username: ", req.session.username, "id_usuario: ", req.session.id_usuario);

    const query = "INSERT INTO posts (item_doado, quantidade, data, codigo_sala, docente, id_usuario, pontuacao_final) VALUES (?, ?, ?, ?, ?, ?,?)"

        db.get(query, [req.session.id_usuario, item_doado, quantidade, data], (err) => {
            if (err) throw err;
            res.redirect('/post-tabela');
        })

    } else {
        res.redirect("/erro");
    }
})

app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.redirect("/");
        }
        res.redirect("/");
    })
});

app.get("/post-tabela", (req, res) => {
    console.log("GET /post-tabela")
    const query = "SELECT * FROM posts";
    db.all(query, [], (err, row) => {
        if (err) throw err;
        console.log(JSON.stringify(row));
        res.render("pages/post-tabela", { titulo: "TABELA DE DOAÇÃO", dados: row, req: res });

    })

});


// Rota de erro 404
app.use('/{*erro}', (req, res) => {
    res.status(404).render('pages/erro', { titulo: "ERRO 404", req, msg: "404" });
});

// Inicializa o servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});

