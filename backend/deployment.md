# Step-by-Step Deployment Guide: Node.js Backend to AWS EC2 (Ubuntu)

Follow these steps to deploy your backend to a production environment.

## 1. Prepare AWS EC2 Instance
1. **Launch Instance**: Choose **Ubuntu 22.04 LTS** (or 24.04).
2. **Security Groups**:
   - Allow **SSH (Port 22)** from your IP.
   - Allow **Custom TCP (Port 5000)** from anywhere (0.0.0.0/0) or from your Frontend IP.
   - (Optional) Allow **HTTP (Port 80)** and **HTTPS (Port 443)** if using Nginx.

## 2. Server Setup (Connect via SSH)
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (v20 or v22)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (Process Manager)
sudo npm install -g pm2

# Install dependencies for Puppeteer (Required for WhatsApp Web)
sudo apt install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget libgbm-dev
```

## 3. Clone and Setup Project
```bash
# Navigate to home
cd ~

# Clone your repository (use SSH or HTTPS)
git clone <your-repo-url>
cd <repo-name>/backend

# Install dependencies
npm install --production
```

## 4. Configure Environment Variables
```bash
# Create .env from example
cp .env.example .env

# Edit .env and paste your MongoDB URI, JWT Secrets, etc.
nano .env
# Press Ctrl+O, Enter to save, Ctrl+X to exit
```

## 5. MongoDB Atlas Whitelisting
**CRITICAL**: MongoDB Atlas blocks connections by default.
1. Go to **Network Access** in MongoDB Atlas.
2. Click **Add IP Address**.
3. Add your **EC2 Public IP** or select "Allow Access from Anywhere" (0.0.0.0/0) - though specific IP is safer.

## 6. Start Application with PM2
```bash
# Start the app using the ecosystem file
pm2 start ecosystem.config.js --env production

# Save PM2 process list to restart on reboot
pm2 save
pm2 startup
# (Run the command displayed by 'pm2 startup')
```

## 7. Verification
- **Check Status**: `pm2 status`
- **Check Logs**: `pm2 logs bizflow-backend`
- **Check Public URL**: Open `http://<EC2-PUBLIC-IP>:5000/health` in your browser.

---

### Pro Tip: Nginx Reverse Proxy (Recommended)
To serve your app on port 80 (standard HTTP) instead of 5000:
1. `sudo apt install nginx -y`
2. Edit `/etc/nginx/sites-available/default`:
   ```nginx
   location / {
       proxy_pass http://localhost:5000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
   }
   ```
3. `sudo nginx -t && sudo systemctl restart nginx`
