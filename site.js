const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = 8000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Conexão com o BD
const db = new sqlite3.Database("doacao.db");
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS cadastro ( id INTEGER PRIMARY KEY AUTOINCREMENT, nome_completo TEXT, email TEXT,senha TEXT,confirmar_senha TEXT, tipo TEXT)"
    );
    db.run("CREATE TABLE IF NOT EXISTS doar ( id INTEGER PRIMARY KEY AUTOINCREMENT, doacao TEXT, item TEXT, quantidade INT, data DATE, aluno TEXT, codigo_sala TEXT,docente TEXT,pontuacao_final INT, id_usuario INT)"
    );
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

// Rota inicial
app.get("/", (req, res) => {
    const nome = req.session.nome_completo || null;
    res.render("pages/index", { nome, req });
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
        console.log("Novo usuário cadastrdo:", nome_completo);
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
    const query = "SELECT * FROM cadastro WHERE email=? AND senha=?"
    db.get(query, [email, senha], (err, row) => {
        if (err) throw err;

        console.log(`row: ${JSON.stringify(row)}`);
        if (row) {
            req.session.loggedin = true;
            req.session.email = row.email;
            req.session.id_usuario = row.id;
            req.session.DocenteLogado = row.tipo === 'Docente';
            res.redirect("/");
        } else {
            res.redirect("/login?mensagem=Usuário ou senha inválidos");

        }
    })
})

// Rota do ranking (visível apenas para docentes logados)
app.get("/ranking", (req, res) => {
        console.log("GET/ ranking")
        const query = `
            SELECT codigo_sala, 
                   doacao, 
                   item,
                   aluno,
                   SUM(item * quantidade) AS pontuacao_total,
                   SUM(quantidade) AS total_itens,
                   MAX(data) AS data_recente,
                   MAX(docente) AS docente
            FROM doar
            GROUP BY codigo_sala
            ORDER BY pontuacao_total DESC
        `;
    db.all(query, [], (err, row) => {
        if (err) throw err;
        console.log(JSON.stringify(row));
        res.render("pages/ranking", { titulo: "Tabela de Doações", dados: row, req: req });
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

app.get("/doar", (req, res) => {
    if (!req.session.id_usuario) {
        return res.redirect("/confirmar");
    }
    res.render("pages/doar", { req: req });
});

app.post("/doar", (req, res) => {
    const {  doacao, item, quantidade, data, aluno, codigo_sala, docente } = req.body;
    const id_usuario = req.session.id_usuario;
    const pontuacao_final = item * quantidade;

    const query = `
        INSERT INTO doar (doacao, item, quantidade, data, aluno, codigo_sala, docente, id_usuario, pontuacao_final)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(query, [doacao, item, quantidade, data, aluno, codigo_sala, docente, id_usuario, pontuacao_final], function (err) {
        if (err) throw err;
        res.redirect("/agradecimento");
    });
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

        const query = "INSERT INTO posts (item_doado, quantidade, data, codigo_sala, docente, id_usuario, pontuacao_final) VALUES (?, ?, ?, ?)"

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

