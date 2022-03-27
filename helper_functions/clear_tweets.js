const TwitterApi = require('twitter-api-v2');

const CONSUMERKEY = process.env.ConsumerKey;
const CONSUMERSECRET = process.env.ConsumerSecret;
const TOKENKEY = process.env.AccessToken;
const TOKENSECRET = process.env.TokenSecret;

const client = new TwitterApi.TwitterApi({
    appKey: CONSUMERKEY,
    appSecret: CONSUMERSECRET,
    // Following access tokens are not required if you are
    // at part 1 of user-auth process (ask for a request token)
    // or if you want a app-only client (see below)
    accessToken: TOKENKEY,
    accessSecret: TOKENSECRET,
  });

let timeline;
let tweetIds;
client.v1.userTimelineByUsername('NesrElFrames').then((x)=> timeline = x).then(() => tweetIds = timeline.tweets.map((tweet) => tweet.id_str)).then(() => tweetIds.forEach((id) => client.v1.deleteTweet(id)))