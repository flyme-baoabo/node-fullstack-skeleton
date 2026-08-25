# Docker 部署与运维手册（Docker Operations Manual）

> 本文档收录本仓库 Docker 相关的**核心校验命令、本地标准启动工作流、日常运维命令**。
> 对应 3 份 Compose 文件：`docker-compose.yml`（生产，镜像由 CI 提前构建）、`docker-compose.local.yml`（本地全容器模拟生产）、`docker-compose.develop.yml`（仅中间件，本机跑 Node）。

---

## 1. 核心校验命令（必用）

启动任何 Compose 栈之前，先用它**校验渲染后的完整配置**，尽早暴露变量缺失 / 语法错误 / 引用不一致：

```bash
# 校验并查看渲染后的完整配置（申明 volumes/networks/services 是否合法、环境变量能否正确插值）
docker compose config

# 导出完整渲染配置用于问题排查 / 存档（后续可按 resolved.txt 逐项核对变量）
docker compose config > resolved.txt
```

> 💡 结合父级 `.env` 一起校验：`docker compose --env-file .env config`。若变量未填或写错，`config` 输出中会出现**空值 / 告警**，比 `up` 启动后再失败更早发现。

---

## 2. 本地标准启动工作流

### 0. 前置：把 `.env` 加载到当前 Shell（仅用于 YAML 插值，不灌入容器）

> Mac / Linux 通用写法。也可以用 `docker compose --env-file .env` 显式指定，效果等价。

```bash
set -a
source .env
set +a
```

### 分场景启动

```bash
# ---- 1. 纯开发模式（本机跑 Node、Docker 仅启动中间件）----
# 适用：日常业务开发、热更新调试、无需容器打包
# 启动 Postgres + Redis 两个中间件容器
docker compose -f docker-compose.develop.yml up -d

# ---- 2. 本地全容器模拟生产（完整容器环境、本地构建镜像）----
#    适用：上线前本地全量自测、复现线上生产环境
#    fullstack-app 含 build: .，用 --build 基于本地 Dockerfile 构建镜像
docker compose -f docker-compose.local.yml up -d --build

# ---- 3. 停止本地全容器模拟生产环境（保留数据卷）----
docker compose -f docker-compose.local.yml down

# ---- 4. 彻底清空本地容器数据（测试重置使用，谨慎操作）----
docker compose -f docker-compose.local.yml down -v
```

### 场景速查表

| 场景 | 用哪个文件 | 命令 | Node 位置 | DB/Redis 访问地址 |
|---|---|---|---|---|
| 日常开发（本机跑 Node） | `docker-compose.develop.yml` | `up -d` | 宿主机 | `127.0.0.1`（须在 Node 侧适配）|
| 本地全容器模拟生产 | `docker-compose.local.yml` | `up -d --build` | 容器 | `postgres` / `redis`（服务名）|
| 停止模拟生产 | `docker-compose.local.yml` | `down` | — | — |
| 重置数据 | `docker-compose.local.yml` | `down -v` | — | — |

> ⚠️ `docker-compose.develop.yml` 只有 Postgres + Redis；此时 Node 跑在宿主机，`.env` 里的 `DB_HOST` / `REDIS_HOST` 需为 `127.0.0.1` 并经 Node 侧适配，容器模式才用服务名 `postgres`/`redis`。

---

## 2. 日常运维命令

```bash
# ---- 停止服务、保留数据卷（下次启动数据仍在）----
docker compose down

# ---- 停止服务、清空所有数据（仅测试环境 / 彻底重置使用，谨慎）----
docker compose down -v
```

> `down` 默认保留命名数据卷；`down -v` 额外删除数据卷，**数据不可恢复**，生产环境切勿使用。

---

## 附：Compose 文件对照

| 文件 | 作用 | image 来源 | Node 进程位置 |
|---|---|---|---|
| `docker-compose.yml` | 生产部署 | `${IMAGE_NAME}:${CI_COMMIT_SHA}`（CI 预构建） | 容器 |
| `docker-compose.local.yml` | 本地全容器模拟生产 | `build: .` 本地构建 | 容器 |
| `docker-compose.develop.yml` | 纯开发中间件 | 官方镜像 | 宿主机 |