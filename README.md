# Nesr El Frames Bot

[![Follow me](https://img.shields.io/twitter/follow/NesrElFrames?labelColor=1DA1F2&color=777777&logo=twitter&logoColor=white&style=flat-square)](https://twitter.com/NesrElFrames)

Twitter bot posting 5 frames every half hour from a 1 FPS episode of [Nesr El Scene](https://www.youtube.com/channel/UC7k3oDrBwFE2mQR09FJetUA) using [Azure functions](https://docs.microsoft.com/en-us/azure/azure-functions/). Technically it can post frames of anything really. Here is how I made it.

## The Problem

So, you have found the best show ever. And you really want to make a twitter bot posting frames from this show like [@SbFramesInOrder](https://twitter.com/SbFramesInOrder) or [@breaking_frames](https://twitter.com/breaking_frames), how would you do it?  
Firstly, you need a bot account on twitter. And a server hosting all the frames you will post and posting it regularly.  
But servers are expensive right?

## Serverless applications

What if I told you that you don't need a server to run all of those things? Just write a small piece of code and run it on the cloud every a fixed interval.  
This is called [serverless computing](https://en.wikipedia.org/wiki/Serverless_computing). One of the serverless computing tools you can use is FasS or [Function as a Service](https://en.wikipedia.org/wiki/Function_as_a_service) in which you can write a code for a small program and the cloud provider will run it every interval you decide. Saving you the hassle of deployment and money of running a server running a small program every half an hour.

## How did I do it?

### Requirements

Now you know that we will use some serverless stuff. What do we need exactly?

- [Twitter account](https://twitter.com/signup) for the bot
- [Twitter developer account](https://developer.twitter.com/en/apply-for-access)
- [Microsoft azure account](https://azure.microsoft.com/en-us/), I am using a [student account](https://azure.microsoft.com/en-us/free/students/) giving me 100$ free credits annually with no credit card required

### Tools

- [NodeJS](https://nodejs.org/en/) 14 LTS
- [Visual studio code](https://code.visualstudio.com/)
- [Azure functions extension](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azurefunctions)
- [Typescript](https://www.typescriptlang.org/)
- [Node twitter API v2](https://www.npmjs.com/package/twitter-api-v2)
- [youtube-dl](https://github.com/ytdl-org/youtube-dl)
- [FFmpeg](https://ffmpeg.org/)

### Setup Azure functions app

First, you need an azure functions app. Go to create a resource, then search for `function app`. Choose a name and a region, the runtime stack should be `Node.js` and version should be `14 LTS`. Also, enable **application insights**, it will become handy later on.

Once azure finishes deployment, you will find some resources were initialized. The important ones are the **Function App** itself and the **Storage Account**.

### Storage

For our function app to run correctly we need a storage medium. Azure provides us with a default [storage account](https://docs.microsoft.com/en-us/azure/storage/common/storage-account-overview). We will specifically use a certain feature called [Azure File Shares](https://docs.microsoft.com/en-us/azure/storage/files/storage-files-introduction). The best part of it is that azure provides you with a [Cloud Shell](https://docs.microsoft.com/en-us/azure/cloud-shell/overview), which is a small server that you can run commands on.

#### Download our videos

Open the cloud shell from the top-right corner of you azure dashboard. Firstly azure will ask you to create a new storage account, we don't want that as we have an existing one.  
Choose `Advanced Options` and choose the an existing storage account. It will ask you to choose a file share which you will not have at the moment, it would be better to create it from the **storage account dashboard** instead of accepting the prompt of creating a new file share in the cloud shell as it **failed** to create one for me.  
Now you will have a small server with your storage mounted on it.

```console
Requesting a Cloud Shell.Succeeded. 
Connecting terminal...

Welcome to Azure Cloud Shell

Type "az" to use Azure CLI
Type "help" to learn about Cloud Shell

kareem@Azure:~$ ls
clouddrive
kareem@Azure:~$ cd clouddrive
kareem@Azure:~/clouddrive$ 
```

Next you can start downloading your favorite videos with [youtube-dl](https://github.com/ytdl-org/youtube-dl) (Nesr El Scene was available on [Youtube](https://www.youtube.com/channel/UC7k3oDrBwFE2mQR09FJetUA), so I will be downloading videos from Youtube)

```console
~/clouddrive$ pip install youtube-dl
~/clouddrive$ youtube-dl <URL> -f webm
```

Note that I downloaded the videos in `webm` format to get the best quality possible. Also, you might experience slow download speeds, most probably that is [something to do with the storage account](https://docs.microsoft.com/en-us/azure/storage/files/storage-troubleshooting-files-performance#cause-3-single-threaded-application) but I am not sure.

#### Extracting frames

Now, we need to extract frames from the videos we have. The function will search for a folder named `videos` in the root. This folder can contain as many folders as you like, each one named with the episode name you want to show in the tweet. Each folder can have as many frames as you want.  
The folders inside `videos` as well as the frames should be sorted correctly by name, please note that while **naming the episode folders** and when extracting the frames.

Let's download [FFmpeg](https://ffmpeg.org/) in the home folder and extract it

```console
~/$ wget https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-amd64-static.tar.xz
~/$ tar -xf ffmpeg-git-amd64-static.tar.xz
```

Then we can extract the frames using the following command

```console
ffmpeg-5.0-amd64-static/ffmpeg -i <Video path> <Destination path>/thumb%06d.png
```

If you have downloaded a different version you will need to change the `ffmpeg` path. The `<Video path>` and `<Destination path>` are self explanatory. The `thumb%06d.png` part is important. It means the frame number should always contain `6` digits, the first frame should be named `thumb000001.png` and so on. This is crucial for the application to figure out which frame is next. **The number of frames should not exceed those 6 digits**, if they do change the 6 to some bigger number.

Also, you need a state file for the function to save state, it is a `JSON` file keeping track of the current episode and frame. Initialize it with the following command in the root of the file share.

```console
~$ cd clouddrive
~/clouddrive$ echo '{"folder":0,"file":0}' > state.json
```

Now you will have have finished setting up the files needed for the application to run.

### Connecting to twitter

After you have created a [twitter account](https://twitter.com/signup) for the bot, you will need to connect an [app](https://developer.twitter.com/en/docs/apps/overview) to this account. Then, you will use some [secrets](https://developer.twitter.com/en/docs/authentication/oauth-1-0a) to control your authenticated account.  
In the following steps we will be making `RESTful HTTP` requests. A `REST` client would come in handy for you to make those requests. I was using [Postman](https://www.postman.com/) as my client. [Insomnia](https://insomnia.rest/) is an other choice recommended by [twitter](https://developer.twitter.com/en/docs/tutorials/how-to-create-a-twitter-bot-with-twitter-api-v2), also you can use [curl](https://curl.se/) if you are a `cli` lover.  
Also, if you got stuck or need additional documentation, this [twitter doc](https://developer.twitter.com/en/docs/tutorials/how-to-create-a-twitter-bot-with-twitter-api-v2) is what I used to create this bot.

#### Authenticating in behalf of the bot

Once you have created your [twitter app](https://developer.twitter.com/en/docs/apps/overview) you will receive your [app token and secret](https://developer.twitter.com/en/docs/authentication/oauth-1-0a/api-key-and-secret). Those are like the username and password for your application (of course keep them safe), Once you connect (or authorize) your app with the bot account you will have another pair of [token and secret](https://developer.twitter.com/content/developer-twitter/en/docs/authentication/oauth-1-0a/obtaining-user-access-tokens) for the user. Afterwards you will need all 4 of those to contact twitter with a request.

To obtain authenticate with the bot account we will be using a method called [3-legged OAuth flow](https://developer.twitter.com/en/docs/authentication/oauth-1-0a/obtaining-user-access-tokens). Here is how it works:

![3-legged OAuth flow](https://cdn.cms-twdigitalassets.com/content/dam/developer-twitter/docs/obtaining-access-tokens.png.twimg.1920.png)

1. [Requesting OAuth token](#requesting-oauth-token)
2. [Using token to authorize the bot](#using-token-to-authorize-the-bot)
3. [Getting the user's access token](#getting-the-users-access-token)

##### Requesting OAuth Token

Create a `POST oauth/request_token` [request](https://developer.twitter.com/en/docs/authentication/api-reference/request_token) using your favorite `REST` client. But note that you will need to sign your requests in [OAuth 1.0a](https://oauth1.wp-api.org/docs/basics/Signing.html) format using your [app token and secret](https://developer.twitter.com/en/docs/authentication/oauth-1-0a/api-key-and-secret).  
[Postman](https://www.postman.com/) provides me with [a tool](https://learning.postman.com/docs/sending-requests/authorization/#oauth-10) to do that, so I will just select `OAuth 1.0a` and make the request.

Finally, the `POST` request should look like this:

```http
POST https://api.twitter.com/oauth/request_token?oauth_callback=oob
```

`oauth_callback` is the callback URL for our application. Since we have no servers running to catch our tokens we put `oob` instead, this indicates that we will be using [PIN-based authorization](https://developer.twitter.com/en/docs/authentication/oauth-1-0a/pin-based-oauth). This will redirect us to a special PIN instead.

The response of this endpoint will be something similar to this:

```bash
oauth_token=zlgW3QAAAAAA2_NZAAABfxxxxxxk&oauth_token_secret=pBYEQzdbyMqIcyDzyn0X7LDxxxxxxxxx&oauth_callback_confirmed=true
```

##### Using token to authorize the bot

Now we can create our authorization URL using the before mentions `oauth_token` in the response. You will need to format your URL like this (with the above response as an example)

```http
https://api.twitter.com/oauth/authenticate?oauth_token=zlgW3QAAAAAA2_NZAAABfxxxxxxk
```

Make sure that you are authorizing the **correct twitter account** (I have fell for it), after authorizing you will receive a 7 digit PIN which you will use in the next step.

##### Getting the user's access token

Now with the PIN you have got earlier, you will get the final [user access token and secret](https://developer.twitter.com/content/developer-twitter/en/docs/authentication/oauth-1-0a/obtaining-user-access-tokens).

You will make a `POST` request like this to [oauth/access_token](oauth/access_token):

```http
https://api.twitter.com/oauth/access_token?oauth_verifier=0535121&oauth_token=zlgW3QAAAAAA2_NZAAABfxxxxxxk
```

- `oauth_verifier` is your 7-digit PIN
- `oauth_token` is the token you used to generate the authentication URL

You will get a response similar to this:

```bash
oauth_token=62532xx-eWudHldSbIaelX7swmsiHImEL4KinwaGloxxxxxx&oauth_token_secret=2EEfA6BG5ly3sR3XjE0IBSnlQu4ZrUzPiYxxxxxx&user_id=1458900662935343104&screen_name=NesrElFrames
```

Where `oauth_token` is the user access token for your bot, and `oauth_token_secret` is the user access secret.

#### Keeping secrets safe

Now we have all we need to make the bot work, we just need to change those values in code, right?  
Storing secret data (API keys) in code is considered a [bad practice](https://blog.gitguardian.com/secrets-api-management/#store-secrets-safely) because it will be easier to steal it. Remember, those keys are considered as you username and password, getting them compromised will compromise you account as well.

So, how can I store my keys safely in a cloud environment. Most cloud providers provide [Secrets as a Service](https://docs.microsoft.com/en-us/azure/architecture/framework/security/design-storage-keys), we will use [Azure Key Vault](https://azure.microsoft.com/en-us/services/key-vault/) to keep our secrets safe. Then, we will provide it to the function as an [environment variable](https://en.wikipedia.org/wiki/Environment_variable).

Steps to setup the [Key Vault](https://azure.microsoft.com/en-us/services/key-vault/) are:

1. Create a [Key Vault](https://azure.microsoft.com/en-us/services/key-vault/) in the same resource group as your function app.
2. Enable [Role-based access control](https://docs.microsoft.com/en-us/azure/role-based-access-control) in your function app, through `Function app -> Settings -> Identity -> System assigned -> Status On -> Save`
3. Grant access to the Key vault, through `Key Vault -> Settings -> Access policies -> New -> Select function app and permissions -> Save`

Now your function app can communicate with the Key Vault. We can start setting up the environment variables. You can setup them in `Function app -> Settings -> Configuration`.

Add them as `ConsumerKey`, `ConsumerSecret`, `AccessToken`, and `TokenSecret`. Their values should look like this:

```powershell
@Microsoft.KeyVault(SecretUri=[Secret_Identifier])
```

Where the `SecretUri` is the secret identifier for each key, you can find it in the Key Vault looking like this:

```http
https://secretsvaultnesrelscene.vault.azure.net/secrets/AccessToken/c6xxxxxxxxxxxxxxxxxxxxxxxxxxxx6
```

And the final value should look similar to this:

```powershell
@Microsoft.KeyVault(SecretUri=[https://secretsvaultnesrelscene.vault.azure.net/secrets/AccessToken/c6xxxxxxxxxxxxxxxxxxxxxxxxxxxx6])
```

If you got stuck refer to [Sander van de Velde's article](https://sandervandevelde.wordpress.com/2019/05/01/it-only-takes-simple-five-steps-to-secure-your-secrets-in-azure-functions/).

### Setting up the function app

#### Mounting storage

Now, you need to [mount your storage file share](https://docs.microsoft.com/en-us/azure/azure-functions/scripts/functions-cli-mount-files-storage-linux) to the function app using this command on the Cloud Shell using this command

```console
az webapp config storage-account add --resource-group <resourceGroup> --name <functionApp> --custom-id <shareId> --storage-type AzureFiles --share-name <share> --account-name <AZURE_STORAGE_ACCOUNT> --mount-path /mnt --access-key <AZURE_STORAGE_KEY>
```

- `<resourceGroup>` is the name of your created resource group
- `<functionApp>` is the name of the function app
- `<shareId>` is a custom ID, can be anything
- `<share>` is the name of your file share
- `<AZURE_STORAGE_ACCOUNT>` is the name of the storage account
- `<AZURE_STORAGE_KEY>` is the storage account key, can be found in `Storage account -> Security + networking -> Access keys`

At the time of creating the bot, the above command kept returning `Invalid credentials`, turned out to be a [known bug](https://github.com/Azure/azure-cli/issues/21571) in Azure servers, so if it did happen to you don't freak out, the file share is now mounted.

#### Deployment

Now you can [deploy](https://docs.microsoft.com/en-us/azure/azure-functions/create-first-function-vs-code-node) your function using [Visual studio code](https://code.visualstudio.com/). The [Azure functions extension](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azurefunctions) should automatically identify this project as a Functions project. You can deploy this function to your azure account.

### Customization

There are some constants you can tinker with in the [code](NesrElSceneBot/index.ts).

- `SKIPPEDFRAMES` is the interval of the frames, it is set to 25, meaning it is tweeting the every 25th frame of the show.
- `FRAMEEACHRUN` is the number of frames tweeted each run, 5 means every time the script runs it tweets 5 frames.
- `schedule` in [function.json](NesrElSceneBot/function.json). A schedule in the form of a [cron expression](https://en.wikipedia.org/wiki/Cron#CRON_expression) used to decide when the script should run.

### Costs

<!-- TODO Update costs -->

Using function apps was for minimizing cost of unnecessary resources, thus reducing costs. But because of my ad-hoc style of creating the bot these figures maybe change.

| Service name     | Service resource     | Spend |
|------------------|----------------------|-------|
| Storage          | LRS Write Operations | $3.75 |
| Storage          | LRS Data Stored      | $0.71 |
| Storage          | Read Operations      | $0.25 |
| Storage          | Protocol Operations  | $0.25 |
| Log Analytics    | Data Ingestion       |  $0.1 |
| Storage          | P10 Disks            | $0.03 |
| Functions        | Execution Time       | $0.02 |
| Total            |                      | $5.25 |

These figures were recorded after processing 5 videos with 77,464 frames (52 minutes and 38 seconds) amounting to 132.25 GiB of data. And after posting 1,415 tweets (23 minutes and 35 seconds).

## Disclaimer

This application was made for fun and I have no intent to use it commercially and I am not endorsing anyone to use it in a way that **harms content creators in any means**.  
Please if you want to use it credit the author of the movie/show, if you want to use this repository **commercially** you will have to get **a consent from the show creator as well as me**.
