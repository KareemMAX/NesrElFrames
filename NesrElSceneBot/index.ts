import { AzureFunction, Context } from "@azure/functions"
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { TwitterApi } from 'twitter-api-v2';
import * as path from 'path';

interface State {
    folder: number,
    file: number
}

const CONSUMERKEY = process.env.ConsumerKey;
const CONSUMERSECRET = process.env.ConsumerSecret;
const TOKENKEY = process.env.AccessToken;
const TOKENSECRET = process.env.TokenSecret;

const timerTrigger: AzureFunction = async function (context: Context, myTimer: any): Promise<void> {
    const userClient = new TwitterApi({
        appKey: CONSUMERKEY,
        appSecret: CONSUMERSECRET,
        // Following access tokens are not required if you are
        // at part 1 of user-auth process (ask for a request token)
        // or if you want a app-only client (see below)
        accessToken: TOKENKEY,
        accessSecret: TOKENSECRET,
      });

    let state: State = JSON.parse(readFileSync("/mnt/state.json", "utf8"));

    const baseUrl = "/mnt/videos/";

    let videos = readdirSync(baseUrl);
    for (let i = 0; i < 5; i++){
        if(state.folder >= videos.length) {
            return;
        }
        let frames = readdirSync(path.join(baseUrl, videos[state.folder]));
        let currentFrame = path.join(baseUrl, videos[state.folder], frames[state.file])

        const mediaId = await userClient.v1.uploadMedia(currentFrame);
        const newTweet = await userClient.v1.tweet(`${videos[state.folder]} - Frame ${(state.file / 25) + 1} of ${Math.floor(frames.length / 25) + 1}`, { media_ids: mediaId });


        context.log(newTweet);
        context.log(state);
        context.log(`Current file: ${currentFrame}`);
        state.file += 25;
        if (state.file >= frames.length) {
            state.file = 0;
            state.folder += 1;
        }
    }
    writeFileSync("/mnt/state.json", JSON.stringify(state))
};

export default timerTrigger;
