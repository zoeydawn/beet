import Fastify from "fastify";
import view from "@fastify/view";
import handlebars from "handlebars";
import session from "@fastify/session";
import rateLimit from "@fastify/rate-limit";

const app = Fastify();

app.register(view, { engine: { handlebars } });

app.register(session, {
  secret: "super-secret",
  cookie: { secure: false },
});

app.register(rateLimit, { max: 100, timeWindow: "15 minutes" });

app.get("/", (req, reply) => {
  reply.view("/templates/home.hbs", { title: "Hello!" });
});

app.listen({ port: 3000 });
