# 反馈服务的容器镜像（零依赖，只装 Node 内置模块）
#
#   docker build -t shota-feedback service/
#   docker run -d -p 8787:8787 -e ADMIN_KEY=... -v /srv/shota-feedback:/data shota-feedback
#
# 只需要 service/ 这一个目录：本文件假设构建上下文就是 service/。
FROM node:22-alpine

# 数据目录（记录与截图）与运行用户
ENV DATA_DIR=/data \
    PORT=8787 \
    NODE_ENV=production

WORKDIR /app
COPY store.mjs server.mjs admin.mjs CONTRACT.md README.md ./

# 以非 root 运行；/data 交给挂载卷，先建好并交给 node 用户
RUN mkdir -p /data/uploads && chown -R node:node /data /app

USER node
EXPOSE 8787

# 容器自身没有种子文件（SEED_FILE 默认指向仓库里的 public/records.json），
# 需要导入历史记录时把它挂进来并设置 SEED_FILE=/seed.json。
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]