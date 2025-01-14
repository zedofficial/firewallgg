// Basic Imports
const config = require("./config.js");
const express = require("express");
const app = express();
const chalk = require('chalk');
const axios = require('axios');
const firewallgg = require("firewallgg");

// Backend Initialization
const backend = require('./backend.js');
backend.init(app);

// Discord Login Passport
const passport = require('passport');
const DiscordStrategy = require('passport-discord-faxes').Strategy;
passport.serializeUser(function(user, done) { done(null, user) });
passport.deserializeUser(function(obj, done) { done(null, obj) });
passport.use(new DiscordStrategy({
    clientID: config.discord.oauthId,
    clientSecret: config.discord.oauthToken,
    callbackURL: `${(config.domain.endsWith('/') ? config.domain.slice(0, -1) : config.domain)}/auth/discord/callback`,
    scope: ['identify', 'guilds', 'email'],
    prompt: 'consent'
}, function(accessToken, refreshToken, profile, done) {
    process.nextTick(function() {
        return done(null, profile);
    });
}));

// Routing
app.get('', async function(req, res) {
    let request = await axios({
        method: 'get',
        url: `https://raw.githubusercontent.com/Itz-Hyperz/firewallgg/main/databases.json`
    });
    let integs = await axios({
        method: 'get',
        url: 'https://raw.githubusercontent.com/Itz-Hyperz/firewallgg/main/partners.json'
    });
    let databases = request?.data;
    let partners = integs?.data;
    res.render('index.ejs', { loggedIn: req.isAuthenticated(), databases: databases, partners: partners });
});

app.get('/account', backend.checkAuth, async function(req, res) {
    let bannedList = await firewallgg(req.session.passport.user.id);
    res.render('account.ejs', { loggedIn: req.isAuthenticated(), user: req.session.passport.user, bannedList: bannedList });
});

app.get('/search/:userid', async function(req, res) {
    if(!req?.params?.userid) return res.redirect('/');
    let bannedList = await firewallgg(req.params.userid);
    res.render('search.ejs', { loggedIn: req.isAuthenticated(), bannedList: bannedList, searchId: req.params.userid });
});

app.post('/backend/search', async function(req, res) {
    if(!req.body) return res.redirect('/');
    res.redirect(`/search/${req.body.userid}`)
})

app.get('/api', async function(req, res) {
    res.render('api.ejs', { loggedIn: req.isAuthenticated() });
});

app.get('/api/checkuser/:userid', async function(req, res) {
    if(!req?.params?.userid) {
        let json_ = [];
        return res.type('json').send(JSON.stringify(json_, null, 4) + '\n');
    } else {
        try {
            let userId = req.params.userid;
            let bans = [];
            let count = 0;
            let check;
            let databaseRequest = await axios({
                method: 'get',
                url: `https://raw.githubusercontent.com/Itz-Hyperz/firewallgg/main/databases.json`
            });
            let databases = databaseRequest.data;
            for(let database of databases) {
                count++
                if(database.active) {
                    let themeColor = database.themeColor || '#FFFFFF';
                    let logoUrl = database.logoUrl || 'https://firewall.gg/assets/logo.png';
                    let data = await makeRequest(database, userId)
                    let _json = "STRING";
                    if(Array.isArray(data)) {
                        // Stronger Together Array Check
                        data = await data.find(o => o.active == 1);
                    };
                    if(data?.blacklistdata?.blacklisted) {
                        data.active = data?.blacklistdata?.blacklisted;
                        data.userid = data?.user?.id || data?.user;
                        data.reason = data?.blacklistdata?.reason || data?.public_reason;
                        data.time = data?.blacklistdata?.date;
                    };
                    if(data?.active) {
                        if(typeof data?.active == 'number') {
                            if(typeof data?.active != 'undefined') {
                                if(data?.active == 1) {
                                    data.active = true;
                                } else {
                                    data.active = false;
                                };
                            };
                        };
                        _json = {
                            "database": database.name,
                            "themeColor": themeColor,
                            "logoUrl": logoUrl,
                            "active": data?.active,
                            "userid": data?.userid || 'NA',
                            "reason": data?.reason || 'NA',
                            "proof": data?.proof || 'None provided...',
                            "time": data?.time || 'NA',
                            "otherData": database.otherData || {}
                        };
                    };
                    if(typeof _json == 'object') {
                        await bans.push(_json);
                    };
                    if(count >= databases.length) {
                        check = true
                    } else {
                        check = false;
                    };
                };
            };
            while(check == true) {
                res.type('json').send(JSON.stringify(bans, null, 4) + '\n');
            };
        } catch(e) {}
    };
});

app.get('/auth/discord', passport.authenticate('discord'));
app.get('/auth/discord/callback', passport.authenticate('discord', {failureRedirect: '/'}), async function(req, res) {
    req.session?.loginRef ? res.redirect(req.session.loginRef) : res.redirect('/');
    delete req.session?.loginRef
});

app.get('/discord', function(req, res) {
    res.redirect('https://store.hyperz.net/discord')
});

// MAKE SURE THIS IS LAST FOR 404 PAGE REDIRECT
app.get('*', function(req, res){
    res.render('404.ejs');
});

// Server Initialization
app.listen(config.port)
console.log(chalk.blue('FirewallGG Started on Port ' + config.port));

// Functions
async function makeRequest(database, userId) {
    let request;
    try {
        request = await axios({
            method: database.method,
            url: `${database.requestUrl}${userId}`,
            headers: {
                'Authorization': `Bearer r1O.CJZ9LVtLKEs2ocpZ0sR1C3436H`
            }
        });
    } catch(e) {
        if(e.toString().includes('Request failed')) {
            request = "failed";
        };
    };
    if(request != "failed") {
        if(!request?.data) return;
        return request.data;
    };
};

// Rejection Handler
process.on('unhandledRejection', (err) => { 
    if(config.debugMode) console.log(chalk.red(err));
});
