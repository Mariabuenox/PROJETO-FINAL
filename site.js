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
    db.run("CREATE TABLE IF NOT EXISTS campanhas ( id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, descricao TEXT, data_inicio TEXT, data_fim TEXT)");
    db.run(`CREATE TABLE IF NOT EXISTS doacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_campanha INTEGER NOT NULL,
        item_doado TEXT NOT NULL,
        quantidade INTEGER NOT NULL,
        docente TEXT NOT NULL,
        codigo_sala TEXT NOT NULL,
        pontuacao_final INTEGER NOT NULL,
        data TEXT NOT NULL,
        FOREIGN KEY (id_campanha) REFERENCES campanhas(id)
    )`);    
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

// Demais rotas
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
        () => res.redirect("/agradecimento_alimento")
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
        () => res.redirect("/agradecimento_pet")

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
        () => res.redirect("/agradecimento_agasalho")

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
        () => res.redirect("/agradecimento_brinquedo")

    );
});


app.get("/agradecimento_alimento", (req, res) => {
    res.render("pages/agradecimento_alimento");
  });

  app.get("/agradecimento_pet", (req, res) => {
    res.render("pages/agradecimento_pet");
  });

  app.get("/agradecimento_agasalho", (req, res) => {
    res.render("pages/agradecimento_agasalho");
  });

  app.get("/agradecimento_brinquedo", (req, res) => {
    res.render("pages/agradecimento_brinquedo");
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

app.get("/tabela_alimento", autenticado, (req, res) => {
    db.all("SELECT * FROM doar_alimento", [], (err, rows) => {
        if (err) throw err;
        res.render("pages/tabela_alimento", {
            titulo: "Doações de Alimentos",
            dados: rows,
            req
        });
    });
});

app.get("/tabela_pet", autenticado, (req, res) => {
    db.all("SELECT * FROM doar_pet", [], (err, rows) => {
        if (err) throw err;
        res.render("pages/tabela_pet", {
            titulo: "Doações PET",
            dados: rows,
            req
        });
    });
});

app.get("/tabela_agasalho", autenticado, (req, res) => {
    db.all("SELECT * FROM doar_agasalho", [], (err, rows) => {
        if (err) throw err;
        res.render("pages/tabela_agasalho", {
            titulo: "Doações de Agasalhos",
            dados: rows,
            req
        });
    });
});

app.get("/tabela_brinquedo", autenticado, (req, res) => {
    db.all("SELECT * FROM doar_brinquedo", [], (err, rows) => {
        if (err) throw err;
        res.render("pages/tabela_brinquedo", {
            titulo: "Doações de Brinquedos",
            dados: rows,
            req
        });
    });
});

app.get("/campanhas", autenticado, (req, res)=>{
    db.all("SELECT * FROM campanhas", [], (err, rows)=>{
        if(err){
            console.error(err);
            return res.send("Erro ao carregar campanhas");
        }
        res.render("pages/listar-campanhas", { campanhas: rows, req });
    });
});

app.get("/criar-campanha", autenticado, (req, res)=>{
    res.render("pages/criar-campanha", { req });
});

app.post("/criar-campanha", autenticado, (req, res)=>{
    const { nome, descricao, data_inicio, data_fim } = req.body;

    db.run(
        "INSERT INTO campanhas (nome, descricao, data_inicio, data_fim) VALUES (?, ?, ?, ?)",
        [nome, descricao, data_inicio, data_fim],
        err=>{
            if(err) return res.send("Erro ao criar campanha");
            res.redirect("/campanhas");
        }
    );
});

app.get('/editar/:id', (req, res) => {
    const id = req.params.id;

    db.get("SELECT * FROM campanhas WHERE id = ?", [id], (err, row) => {
        if (err) {
            console.error(err);
            return res.send("Erro ao carregar campanha.");
        }

        if (!row) return res.send("Campanha não encontrada!");

        res.render("editar", { campanha: row }); // página editar.ejs
    });
});

app.post('/editar/:id', (req, res) => {
    const { nome, descricao, data_final } = req.body;
    const id = req.params.id;

    db.run("UPDATE campanhas SET nome = ?, descricao = ?, data_final = ? WHERE id = ?",
        [nome, descricao, data_final, id],
        err => {
            if (err) {
                console.error(err);
                return res.send("Erro ao salvar edição.");
            }

            res.redirect("/campanhas");
        }
    );
});

app.get("/excluir-campanha/:id", autenticado, (req, res)=>{
    db.run("DELETE FROM campanhas WHERE id=?", [req.params.id], err=>{
        if(err) return res.send("Erro ao excluir campanha");
        res.redirect("/campanhas");
    });
});

app.get("/doar/editar/:id", autenticado, (req, res) => {
    db.get("SELECT * FROM doacoes WHERE id=?", [req.params.id], (err, doacao) => {
        if (err || !doacao) return res.send("Doação não encontrada");

        res.render("pages/editar-doacao", { doacao });
    });
});


app.post("/doar/editar/:id", autenticado, (req, res) => {
    const { item_doado, quantidade, docente, codigo_sala, pontuacao_final } = req.body;

    db.run(
        "UPDATE doacoes SET item_doado=?, quantidade=?, docente=?, codigo_sala=?, pontuacao_final=? WHERE id=?",
        [item_doado, quantidade, docente, codigo_sala, pontuacao_final, req.params.id],
        err => {
            if (err) return res.send("Erro ao atualizar doação");
            res.redirect("/doacoes"); // página onde lista as doações
        }
    );
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

