# Beet

### An ultra‑lightweight AI chat app, built for speed and performance. Powered by open-source LLMs. 

[Check it out here](https://beet.zoey.ninja/)

**Beet** is a fast and friendly AI Chat. It utilizes open-source LLMs via the **Hugging Face** inference API. It's built with **Node**, **Fastify**, **HTMX**, **Redis**, and **Handlebars**. 

---

### Install and run from source:

Clone the repository:
```
git clone git@github.com:zoeydawn/beet.git
```

Change directory and install dependencies: 
```
cd beet/
npm i
```

The following environment variables must be set:

`REDIS_URL` 
- The easiest way to get started is with a free account at [cloud.redis.io](https://cloud.redis.io)
`JWT_SECRET` 
- Just create a long random string using your password manager 
`HUGGING_FACE_API_KEY` 
- Get one at [huggingface.co](https://huggingface.co/). New accounts get $0.10 in free inference credits (which doesn't sound like much but it actually goes a long way).
`SESSION_SECRET` 
-  Create another long, random string

Example .env file:
```
REDIS_URL=<URL to your Redis DB>
JWT_SECRET="a long random string"
HUGGING_FACE_API_KEY=<Your HF API key>
SESSION_SECRET="a long random string"
```

Also, make sure to set `NODE_ENV="production"` in any production deploy.

Run the development server:
```
npm run dev
```

Navigate to [localhost:3000](http://localhost:3000/)

---

### What makes Beet lightweight and fast? 
- Minimal front-end: Beet utilizes **HTMX** to load the bare minimum of HTML content. It only loads what you need at the moment, so the pages and views load quickly. It also includes small CSS and JavaScript files consisting of only what is needed in the browser. The heavy lifting is all done server side.
- A quick server thanks to **Fastify** running on **Node.js**.
- **Redis** as the database. No, not a caching layer, the entire standalone database! So reads and writes happen quickly within RAM adding no noticeable time to API calls. The database is persisted so that user data is safe. 
- **Cloudflare CDN**: Beet is deployed on **Railway** and proxied through Cloudflare. Not only is this good for security, but it adds a boost to speed thanks to Cloudflare's CDN caching static assets. 
- We choose quick LLMs and inference providers via the **Hugging Face inference API**. Though the actual speed of the streaming response can vary a lot depending on how much traffic the inference provider is experiencing, we find it to be pretty fast most of the time. 

### Why the weird stack?
A couple of reasons:
- I've worked so much with big JavaScript frameworks, mostly React and Next, and I wanted to do something radically different. 
- It was a great excuse to experiment with new technologies. I was very intrigued by the simplicity of HTMX, and I was looking for something to build with it. I had experience with Redis, but mostly used it as a caching layer. I had been wanting to try using Redis as a standalone database. Beet was an opportunity to try these things out.
- Something built with HTMX and Redis would be lightweight and fast, so I chose the rest of the stack with speed and performance in mind.

### Why I built it:
It started when I was playing around with open-source LLMs (I happen to really like open-source things). I was running small LLMs on my machine with **Ollama**. One day, as is typical of me, I said "hey, I could build a front-end for this!" That's how Beet got started. 

I realized it was much more practical to use inference API providers than it was to run my own models with Ollama, so I switched to Hugging Face. I like the Hugging Face inference API because it gives me access to many inference providers, and therefore many open-source models. 

I chose models that are useful and fast. My published demo only provides a few small models because I don't want to make larger models available to the world at my expense. The more powerful models are "premium" and can only be accessed by "premium accounts". Want a premium account? Contact me, and tell me what username you used to sign up, and I can set your account to premium. 


### Contributions are welcome!
Feel free to open an issue or pull request. Beet is also MIT Licensed so feel free to fork and use as you wish.
