# MC Mod Hub

One search box for Minecraft mods, add-ons, packs, shaders, maps and skins. MC Mod Hub searches Modrinth, CurseForge, Hangar, SpigotMC, GitHub and about eight other sites at once and merges the results into a single table.

The good parts:

- **Everything in one table.** Sort and filter by edition (Java or Bedrock), game version, downloads and dates.
- **Browse without typing.** Category tiles for mods, modpacks, resource packs, shaders, Bedrock add-ons and more, plus a notice board of what's new.
- **Install to your server.** Mount your server's mods folder and install or update mods with one click.

Image: [allornothing/mc-mod-hub](https://hub.docker.com/r/allornothing/mc-mod-hub) · Source: [aon082910/mc-mod-hub](https://github.com/aon082910/mc-mod-hub)

## Install

**Unraid:** Copy `templates/mc-mod-hub.xml` into `/boot/config/plugins/dockerMan/templates-user/`, then Docker tab → Add Container and pick `mc-mod-hub`.

**Docker:**

```bash
docker run -d --name mc-mod-hub -p 8080:8080 \
  -v /mnt/user/appdata/mc-mod-hub:/data \
  allornothing/mc-mod-hub:latest
```

| Setting | Default | What it's for |
|---|---|---|
| Port | `8080` | Web UI |
| `/data` | `/mnt/user/appdata/mc-mod-hub` | Database and saved keys |
| `/mods` | none | Optional: your Minecraft server's mods folder |
| `ADMIN_PASSWORD` | `admin` | First-login password. Change it right away |
| `SESSION_SECRET` | auto | Optional |

## First run

Open `http://<unraid-ip>:8080/admin.html`, log in, and change the password. Then paste in a CurseForge key and a YouTube Data API key if you want those sources. Modrinth, Hangar, Spiget and most others need no key. Keys live in the database, so you can swap them anytime.

## Help

[Open an issue](https://github.com/aon082910/mc-mod-hub/issues). MIT licensed.
