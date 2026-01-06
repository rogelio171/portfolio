# Rogelio Orona - Portfolio

A modern, professional portfolio website for a Senior Software Engineer built with [Hugo](https://gohugo.io/) and the [Blowfish](https://blowfish.page/) theme.

## ✨ Features

- 🎨 **Modern UI** - Clean, professional design with dark theme and cyan accents
- 📱 **Responsive** - Optimized for all devices (mobile, tablet, desktop)
- ⚡ **Fast** - Lighthouse 95+ scores with optimized assets and caching
- 📝 **Blog** - Technical blog with SEO optimization
- 🔍 **Search** - Full-text search functionality
- 🏷️ **Tags** - Organized content with tagging support
- ♿ **Accessible** - WCAG 2.1 AA compliant with keyboard navigation
- 🔒 **Secure** - Security headers, CSP, HSTS
- 📊 **Analytics Ready** - GA4 and Plausible support
- 📧 **Contact Form** - Formspree integration

## 🛠️ Tech Stack

- **Hugo 0.141.0** - Static site generator (Extended version)
- **Blowfish Theme v2** - Modern Hugo theme
- **GitHub Actions** - Automated deployment to GitHub Pages
- **Formspree** - Contact form handling (optional)
- **Google Analytics 4 / Plausible** - Privacy-friendly analytics (optional)

## 🚀 Quick Start

### Prerequisites

- [Hugo Extended](https://gohugo.io/installation/) (v0.112.0 or later)
- [Go](https://golang.org/dl/) (v1.18 or later, for Hugo Modules)

### Local Development

```bash
# Clone the repository
git clone https://github.com/rogelioorona/portfolio.git
cd portfolio

# Start the development server
hugo server -D

# Or with live reload and draft posts
hugo server -D --disableFastRender
```

Visit `http://localhost:1313/portfolio/` in your browser.

### Building for Production

```bash
# Build with minification (recommended for production)
hugo --minify

# Build with garbage collection (cleans up unused resources)
hugo --minify --gc
```

The static files will be generated in the `public/` directory.

## 📝 Content Management

### Adding Blog Posts

Create a new blog post with all necessary frontmatter:

```bash
hugo new blog/my-new-post/index.md
```

Edit the generated file and add your content:

```markdown
---
title: "Your Post Title"
date: 2026-01-04
draft: false
description: "SEO-optimized description (150-160 characters)"
summary: "Shorter summary for cards"
tags: ["tag1", "tag2"]
categories: ["Category"]
featured_image: "featured.jpg"  # Optional
keywords: ["keyword1", "keyword2"]  # Optional
---

Your content here...
```

### Adding Project Images

1. Add project screenshots to `static/img/projects/`
2. Reference them in your content:

```markdown
{{< project-card
  title="Project Name"
  subtitle="Company Name"
  description="Project description"
  image="/img/projects/project-name.png"
  tags="Java, Spring Boot, React"
>}}
```

### Updating Contact Information

Update your email and social links in `config/_default/params.toml`:

```toml
[author]
  name = "Your Name"
  email = "mailto:your@email.com"
  links = [
    { github = "https://github.com/yourusername" },
    { linkedin = "https://linkedin.com/in/yourusername" },
  ]

[contact]
  email = "your@email.com"
```

## 📊 Analytics Setup (Optional)

### Option 1: Google Analytics 4

1. Create a GA4 property at [Google Analytics](https://analytics.google.com)
2. Get your Measurement ID (format: `G-XXXXXXXXXX`)
3. Update `config/_default/params.toml`:

```toml
[analytics.ga4]
  enabled = true
  measurementId = "G-XXXXXXXXXX"
  anonymizeIP = true
  respectDoNotTrack = true
  disableAdFeatures = true
```

### Option 2: Plausible Analytics (Privacy-Friendly)

1. Sign up at [Plausible.io](https://plausible.io) or self-host
2. Add your domain
3. Update `config/_default/params.toml`:

```toml
[analytics.plausible]
  enabled = true
  dataDomain = "yourdomain.com"
  scriptUrl = "https://plausible.io/js/script.js"
```

## 📧 Contact Form Setup (Optional)

1. Create a free account at [Formspree](https://formspree.io)
2. Create a new form and get your form ID
3. Update `config/_default/params.toml`:

```toml
[contact]
  formspreeId = "xyzabcdef"  # Your Formspree form ID
```

The contact form is now live at `/contact/`!

## 🎨 Customization

### Colors & Branding

Update colors in `assets/css/custom.css`:

```css
:root {
  --primary-color: #64ffda;  /* Your brand color */
  --primary-dark: #4fd1b0;
  --bg-dark: #0a0a0a;
  /* ... more variables ... */
}
```

### Favicon

Replace these files in `static/`:
- `favicon.svg` - Main favicon
- `apple-touch-icon.svg` - iOS/macOS icon
- Update `site.webmanifest` with your brand colors

### Profile Photo

Replace `static/img/profile-placeholder.svg` with your professional photo:
- Recommended: 400x400px minimum
- Format: JPG or PNG
- Filename: `profile.jpg` or `profile.png`

## 🔧 Configuration Files

- `config/_default/hugo.toml` - Hugo configuration, minification, imaging
- `config/_default/params.toml` - Site parameters, analytics, contact
- `config/_default/menus.toml` - Navigation menu
- `assets/css/custom.css` - Custom styles and theme

## 📦 Deployment

### GitHub Pages (Automatic)

This site is configured for automatic deployment to GitHub Pages:

1. Push to `main` branch
2. GitHub Actions builds the site with Hugo
3. Site is deployed to GitHub Pages
4. Visit: `https://yourusername.github.io/portfolio/`

### Custom Domain

1. Add your domain to `static/CNAME`:
   ```
   yourdomain.com
   ```

2. Update `config/_default/hugo.toml`:
   ```toml
   baseURL = 'https://yourdomain.com/'
   ```

3. Configure DNS at your domain registrar:
   - Type: `A`
   - Name: `@`
   - Value: GitHub Pages IPs (see [GitHub Docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site))

### Other Hosting Providers

#### Netlify
```bash
# netlify.toml
[build]
  command = "hugo --minify --gc"
  publish = "public"

[build.environment]
  HUGO_VERSION = "0.141.0"
  HUGO_ENV = "production"
```

#### Vercel
```json
{
  "build": {
    "command": "hugo --minify --gc"
  },
  "env": {
    "HUGO_VERSION": "0.141.0"
  }
}
```

## 🧪 Testing

### Lighthouse Audit

```bash
# Build for production
hugo --minify --gc

# Serve the public directory
cd public && python3 -m http.server 8000

# Run Lighthouse
lighthouse http://localhost:8000 --view
```

Target scores:
- Performance: 95+
- Accessibility: 100
- Best Practices: 100
- SEO: 100

### Accessibility Testing

- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- Keyboard navigation (Tab, Shift+Tab, Enter, Escape)
- Screen reader testing (NVDA, JAWS, VoiceOver)

## 📚 Documentation

- [CHANGELOG.md](CHANGELOG.md) - Detailed list of all improvements
- [Hugo Documentation](https://gohugo.io/documentation/)
- [Blowfish Theme Docs](https://blowfish.page/)

## 🤝 Contributing

This is a personal portfolio, but feel free to:
- Report bugs
- Suggest improvements
- Use as a template for your own portfolio

## 📄 License

MIT License - feel free to use this as a template for your own portfolio!

## 🙏 Acknowledgments

- [Hugo](https://gohugo.io/) - The world's fastest framework for building websites
- [Blowfish Theme](https://blowfish.page/) - Beautiful Hugo theme
- [Devicons](https://devicon.dev/) - Programming language icons

---

## 🔗 Live Site

Visit the live portfolio at: [https://rogelioorona.github.io/portfolio/](https://rogelioorona.github.io/portfolio/)

## 📧 Contact

- Email: rogelio.orona@proton.me
- LinkedIn: [rogelioorona](https://linkedin.com/in/rogelioorona)
- GitHub: [@rogelioorona](https://github.com/rogelioorona)
