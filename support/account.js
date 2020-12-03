var dotenv = require('dotenv');
dotenv.config()
const nanoid = require('nanoid');
const mongo = require('mongodb'); // eslint-disable-line import/no-unresolved
const MongoClient = mongo.MongoClient;

let DB;

// const store = new Map();
const logins = new Map();

(async () => { //init DB connection
  const connection = await MongoClient.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
  });
  DB = connection.db(connection.s.options.dbName);
})();

class Account {
  constructor(id, profile) {
    this.accountId = id || nanoid();
    this.profile = profile;
    // store.set(this.accountId, this);
  }

  /**
   * @param use - can either be "id_token" or "userinfo", depending on
   *   where the specific claims are intended to be put in.
   * @param scope - the intended scope, while oidc-provider will mask
   *   claims depending on the scope automatically you might want to skip
   *   loading some claims from external resources etc. based on this detail
   *   or not return them in id tokens but only userinfo and so on.
   */
  async claims(use, scope) { // eslint-disable-line no-unused-vars
    if (this.profile) {
      return {
        sub: this.accountId, // it is essential to always return a sub claim
        email: this.profile.email,
        email_verified: this.profile.email_verified,
        family_name: this.profile.family_name,
        given_name: this.profile.given_name,
        locale: this.profile.locale,
        name: this.profile.name,
      };
    }

    return {
      sub: this.accountId, // it is essential to always return a sub claim
    };
  }

  static async findByFederated(provider, claims) {
    const id = `${provider}.${claims.sub}`;
    if (!logins.get(id)) {
      logins.set(id, new Account(id, claims));
    }
    return logins.get(id);
  }

  static async findByLogin(login, password) {
    let coll = DB.collection('users');
    let res = await coll.findOne({email: login});
    let result;
    if (res.password === password) {
      result = {
        accountId: res._id,
        scope: ['openid']
      };
      delete res.password;
      logins.set(login, new Account(res._id, res));
    } else {
      throw new Error('access_denied');
    }

    return result;
  }

  static async findAccount(ctx, id, token) { // eslint-disable-line no-unused-vars
    // token is a reference to the token used for which a given account is being loaded,
    //   it is undefined in scenarios where account claims are returned from authorization endpoint
    // ctx is the koa request context
    let coll = DB.collection('users');
    let res = await coll.findOne({_id: new mongo.ObjectID(id)});

    let result = undefined;
    if (res != null) {
      result = new Account(res._id, res);
    }

    return result;

    // if (!store.get(id)) {}new Account(id); // eslint-disable-line no-new
    // return store.get(id);
  }
}

module.exports = Account;
