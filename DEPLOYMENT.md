# ☁️ Cloud Deployment Guide: Deploy Online For Employers & Evaluators

This guide provides step-by-step instructions to deploy **Nexus RAG** online with a public URL so hiring managers, recruiters, and clients can test it live in seconds.

---

## 🏆 Option 1: Hugging Face Spaces (100% Free & Most Recommended for Portfolios)

Hugging Face Spaces provides **free 2-vCPU / 16GB RAM** hosting with native Docker support. It gives you a clean public URL like `https://huggingface.co/spaces/YOUR_USERNAME/enterprise-rag-assistant`.

### Step-by-Step Instructions:

1. **Create a Hugging Face Account**:
   - Go to [huggingface.co](https://huggingface.co/) and sign in.

2. **Create a New Space**:
   - Visit [huggingface.co/new-space](https://huggingface.co/new-space).
   - **Space Name:** `enterprise-rag-assistant`
   - **License:** `mit` or `apache-2.0`
   - **Space SDK:** Choose **Docker** -> **Blank**.
   - **Visibility:** Public.
   - Click **Create Space**.

3. **Configure Port 8000 for Hugging Face**:
   - Hugging Face automatically routes traffic to port `7860`.
   - In your Space settings or in your Dockerfile, set `ENV PORT=7860` and `EXPOSE 7860`, or pass `--port 7860` to Uvicorn.
   - *(Nexus RAG dynamically reads `PORT` from environment variables, defaulting to 8000 locally and 7860 on Hugging Face).*

4. **Push the Code to Hugging Face**:
   ```bash
   git remote add space https://huggingface.co/spaces/YOUR_USERNAME/enterprise-rag-assistant
   git push space main
   ```

5. **Set Environment Secrets (Optional)**:
   - In your Space, navigate to **Settings** > **Variables and secrets**.
   - Add `GEMINI_API_KEY` (Free tier from [Google AI Studio](https://aistudio.google.com/)).
   - Alternatively, leave it blank! The built-in **Smart Local Synthesizer** will run automatically with zero external API keys!

6. **Share the Link with Employers**:
   - Your public URL is immediately live:
     `https://YOUR_USERNAME-enterprise-rag-assistant.hf.space`

---

## 🚀 Option 2: Render.com (Free Docker Web Service)

Render allows you to deploy Docker containers directly from a GitHub repository.

### Step-by-Step Instructions:

1. Push this repository to your GitHub account:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Enterprise RAG Assistant"
   git remote add origin https://github.com/YOUR_USERNAME/enterprise-rag-assistant.git
   git push -u origin main
   ```

2. Go to [dashboard.render.com](https://dashboard.render.com/) and click **New +** > **Web Service**.

3. Connect your GitHub repository.

4. Select **Docker** as the Runtime environment.

5. Configure Service:
   - **Name:** `enterprise-rag-assistant`
   - **Region:** Any (e.g. Oregon, Frankfurt)
   - **Instance Type:** Free

6. Add Environment Variables:
   - `APP_ENV`: `production`
   - `SECRET_KEY`: `<generate-any-32-char-random-string>`
   - `GEMINI_API_KEY`: `<your-gemini-key-optional>`

7. Click **Create Web Service**.
   - Render will build the Docker container and provide a live URL like:
     `https://enterprise-rag-assistant.onrender.com`

---

## ⚡ Option 3: Railway.app (Fastest 1-Click Deploy)

1. Install the Railway CLI or use the Web UI:
   ```bash
   npm i -g @railway/cli
   railway login
   railway init
   railway up
   ```

2. Generate a public domain under **Settings > Domains**.

---

## 🐳 Option 4: Local or VPS Docker Deployment

If deploying to your own VPS (Ubuntu/Debian on AWS EC2, DigitalOcean, or Hetzner):

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/enterprise-rag-assistant.git
cd enterprise-rag-assistant

# Start with Docker Compose
docker-compose up -d --build

# View container logs
docker-compose logs -f
```

The application is now accessible at `http://YOUR_SERVER_IP:8000`.

---

## 💡 Evaluator Demo Checklist for Recruiters & Employers

When employers test your live deployment:
1. **Zero Setup Friction**: They can click **"1-Click Demo Login"** on the sign-in modal to immediately unlock full functionality without typing an email.
2. **Pre-Loaded Documents**: They can click **"Load Demo PDFs"** in the top bar to immediately index multi-page corporate compliance and financial reports.
3. **One-Click Sample Questions**: They can click any sample query card on the welcome screen to watch the streaming RAG generation.
4. **Transparent Verification**: They can click any citation badge (e.g., `[Acme_Corp_Cloud_Security_Policy.pdf, Page 2]`) to slide open the Source Citation Drawer and verify the exact page excerpt and match score.
