import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { REST, Routes } from '../discord.js';

const commandsPath = path.join(fileURLToPath(new URL('.', import.meta.url)), '..', 'commands');

export async function deployCommands({ enabledNames } = {}) {
    const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
    const commands = [];

    for (const file of files) {
        try {
            const mod = await import(pathToFileURL(path.join(commandsPath, file)).href);
            const command = mod.default || mod;
            if (!command?.data || command.disabled) continue;
            if (enabledNames && !enabledNames.has(command.data.name)) continue;
            commands.push(command.data.toJSON());
        } catch (err) {
            throw new Error(`${file} 로드 실패: ${err.message}`);
        }
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
    const data = process.env.GUILD_ID
        ? await rest.put(
              Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
              { body: commands },
          )
        : await rest.put(
              Routes.applicationCommands(process.env.CLIENT_ID),
              { body: commands },
          );

    return { deployed: data.length };
}
