#!/usr/bin/env node

/**
 * NIRA 명령어 및 스케줄 문서 자동 생성 스크립트 (ESM) - 파라미터 표/choices 포함
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMMANDS_DIR = path.resolve(__dirname, '../src/commands');
const SCHEDULE_DIR = path.resolve(__dirname, '../src/schedule');
const DOCS_OUTPUT_DIR = path.resolve(__dirname, '../docs/docs');

const CATEGORIES = {
  utility: { name: '유틸리티', description: '계산, 변환, 시간 등 일상적인 도구들', keywords: ['calculation', 'clock', 'length', 'exchange', 'base64', 'color'] },
  information: { name: '정보 조회', description: '주식, 환율, 핫딜 등 실시간 정보 조회', keywords: ['stock', 'hotdeal', 'price', 'exchange', 'newsletter'] },
  fun: { name: '재미/게임', description: '주사위, 동전, 추첨 등 재미있는 기능들', keywords: ['coin', 'choice', 'random', 'lottory', 'omikuji', 'oddoreven', 'simulation'] },
  text: { name: '텍스트 처리', description: '텍스트 변환, 처리 관련 기능들', keywords: ['reverse', 'say', 'random_letter', 'thatlong'] },
  admin: { name: '관리/시스템', description: '봇 관리 및 시스템 기능들', keywords: ['delete', 'upgrade', 'ping', 'invite', 'homepage'] },
  social: { name: '소셜/커뮤니티', description: '투표, 아바타 등 소셜 기능들', keywords: ['vote', 'avatar', 'vxtwitter'] },
  misc: { name: '기타', description: '기타 다양한 기능들', keywords: ['dday', 'years', 'emoji', 'mart', 'tax', 'gemini'] },
};

function extractChoices(block) {
  const choices = [];
  const idx = block.indexOf('.addChoices(');
  if (idx !== -1) {
    let openParens = 0;
    let endIndex = -1;
    for (let i = idx + 12; i < block.length; i++) { // 12 is length of '.addChoices('
      if (block[i] === '(') openParens++;
      else if (block[i] === ')') {
        if (openParens === 0) {
          endIndex = i;
          break;
        }
        openParens--;
      }
    }
    
    if (endIndex !== -1) {
      const inner = block.substring(idx + 12, endIndex);
      const objRegex = /\{\s*name:\s*['"`]([^'"`]+)['"`],\s*value:\s*['"`]([^'"`]+)['"`]\s*\}/g;
      for (const m of inner.matchAll(objRegex)) {
        choices.push({ name: m[1], value: m[2] });
      }
    }
  }
  return choices;
}

function findOptionBlocks(content) {
  const blocks = [];
  const optionTypes = [
    'addStringOption', 'addIntegerOption', 'addBooleanOption', 
    'addUserOption', 'addChannelOption', 'addNumberOption', 'addAttachmentOption'
  ];
  
  for (const type of optionTypes) {
    let startIndex = 0;
    while (true) {
      const idx = content.indexOf(`.${type}(`, startIndex);
      if (idx === -1) break;
      
      let openParens = 0;
      let endIndex = -1;
      
      for (let i = idx + type.length + 1; i < content.length; i++) {
        if (content[i] === '(') {
          openParens++;
        } else if (content[i] === ')') {
          openParens--;
          if (openParens === 0) {
            endIndex = i;
            break;
          }
        }
      }
      
      if (endIndex !== -1) {
        blocks.push({
          type,
          content: content.substring(idx, endIndex + 1)
        });
        startIndex = endIndex + 1;
      } else {
        startIndex = idx + 1;
      }
    }
  }
  return blocks;
}

function extractCommandInfo(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileBase = path.basename(filePath);
    const fileName = fileBase.replace(/\.(js|ts|mjs)$/i, '');
    const nameMatch = content.match(/\.setName\(['"`]([^'"`]+)['"`]\)/u);
    const descMatch = content.match(/\.setDescription\(['"`]([^'"`]+)['"`]\)/u);

    const options = [];
    const optionBlocks = findOptionBlocks(content);
    
    for (const block of optionBlocks) {
      const typeMap = {
        addStringOption: 'string',
        addIntegerOption: 'integer',
        addBooleanOption: 'boolean',
        addUserOption: 'user',
        addChannelOption: 'channel',
        addNumberOption: 'number',
        addAttachmentOption: 'attachment',
      };
      
      const type = typeMap[block.type] || 'string';
      const optName = block.content.match(/\.setName\(['"`]([^'"`]+)['"`]\)/u);
      const optDesc = block.content.match(/\.setDescription\(['"`]([^'"`]+)['"`]\)/u);
      const required = /\.setRequired\(true\)/.test(block.content);
      const choices = extractChoices(block.content);
      
      // Extract default value from description
      let defaultValue = '';
      if (optDesc) {
        const defaultMatch = optDesc[1].match(/\((?:기본|default):\s*([^)]+)\)/i);
        if (defaultMatch) {
          defaultValue = defaultMatch[1].trim();
        }
      }
      
      if (optName && optDesc) {
        options.push({ 
          name: optName[1], 
          description: optDesc[1], 
          required, 
          type, 
          choices,
          defaultValue
        });
      }
    }

    const exampleMatch = content.match(/\/\*\*?[\s\S]*?예시[\s\S]*?\*\//iu) || content.match(/\/\/.*예시.*/u);

    return {
      fileName,
      name: nameMatch ? nameMatch[1] : fileName,
      description: descMatch ? descMatch[1] : '설명 없음',
      options,
      example: exampleMatch ? exampleMatch[0].replace(/\/\*\*?|\*\//g, '').trim() : null,
      category: categorizeCommand(fileName),
    };
  } catch (e) { console.warn(`파일 처리 오류: ${filePath}: ${e.message}`); return null; }
}

function categorizeCommand(fileName) { for (const [id, cat] of Object.entries(CATEGORIES)) if (cat.keywords.includes(fileName)) return id; return 'misc'; }

function extractScheduleInfo(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileBase = path.basename(filePath);
    const fileName = fileBase.replace(/\.(js|ts|mjs)$/i, '');
    const cronMatches = [...content.matchAll(/['"`]([0-9*\/,\-]+\s+[0-9*\/,\-]+\s+[0-9*\/,\-]+\s+[0-9*\/,\-]+\s+[0-9*\/,\-]+)['"`]/g)].map(m => m[1]);
    const descMatch = content.match(/\/\*\*?([^*]+(?:\*(?!\/)[^*]*)*)\*\//);
    const lineCommentMatch = content.match(/\/\/\s*(.+)/);
    return { fileName, name: fileName.replace(/([A-Z])/g, ' $1').replace(/^./, s=>s.toUpperCase()), description: descMatch?descMatch[1].trim(): (lineCommentMatch?lineCommentMatch[1].trim():'설명 없음'), cronPatterns: cronMatches, category: categorizeSchedule(fileName) };
  } catch (e) { console.warn(`스케줄 처리 오류: ${filePath}: ${e.message}`); return null; }
}

function categorizeSchedule(fileName) { if (/hotdeal/i.test(fileName)) return 'hotdeal'; if (/news/i.test(fileName)) return 'news'; if (/karaoke/i.test(fileName)) return 'entertainment'; if (/splatoon/i.test(fileName)) return 'gaming'; return 'misc'; }

function mdTable(rows) {
  const header = '| 이름 | 타입 | 필수 | 기본값 | 설명 | 선택지 |\n|---|---|---|---|---|---|\n';
  return header + rows.map(r => `| ${r.name} | ${r.type} | ${r.required ? '✅' : ''} | ${r.defaultValue || ''} | ${r.description} | ${r.choices?.length ? r.choices.map(c=>`${c.name}(${c.value})`).join('<br/>') : ''} |`).join('\n') + '\n';
}

function generateCommandDocs(commands) {
  const grouped = commands.reduce((acc, c) => { (acc[c.category] ||= []).push(c); return acc; }, {});
  let index = `---\nsiderbar_position: 1\n---\n\n# 명령어 목록\n\nNIRA가 제공하는 모든 슬래시 명령어입니다.\n\n`;
  for (const [id, list] of Object.entries(grouped)) {
    const cat = CATEGORIES[id];
    index += `## ${cat.name}\n\n${cat.description}\n\n`;
    list.forEach(c => { index += `- **\`/${c.name}\`** - ${c.description}\n`; });
    index += `\n`;
  }
  const commandsDir = path.join(DOCS_OUTPUT_DIR, 'commands');
  fs.mkdirSync(commandsDir, { recursive: true });
  fs.writeFileSync(path.join(commandsDir, 'index.md'), index);
  fs.writeFileSync(path.join(commandsDir, '_category_.json'), JSON.stringify({ label: '명령어', position: 2, link: { type: 'generated-index', description: 'NIRA 슬래시 명령어 카테고리별 목록' } }, null, 2));

  for (const [id, list] of Object.entries(grouped)) {
    const cat = CATEGORIES[id];
    let md = `---\nsidebar_position: ${Object.keys(CATEGORIES).indexOf(id) + 3}\n---\n\n# ${cat.name}\n\n${cat.description}\n\n`;
    list.forEach(c => {
      md += `## \`/${c.name}\`\n\n**설명:** ${c.description}\n\n`;
      if (c.options.length) {
        md += `**파라미터:**\n\n` + mdTable(c.options) + `\n`;
      } else {
        md += `**파라미터:** 없음\n\n`;
      }
      md += `**사용법:**\n\`\`\`\n/${c.name}`;
      const req = c.options.filter(o=>o.required); const opt = c.options.filter(o=>!o.required);
      if (req.length) md += ' ' + req.map(o=>`<${o.name}>`).join(' ');
      if (opt.length) md += ' [' + opt.map(o=>o.name).join('] [') + ']';
      md += `\n\`\`\`\n\n`;
      if (c.example) md += `**예시:**\n${c.example}\n\n`;
      md += `---\n\n`;
    });
    fs.writeFileSync(path.join(commandsDir, `${id}.md`), md);
  }
}

function cronToReadable(cron) { if (cron === '0 9 * * *') return '매일 오전 9시'; if (cron === '0 * * * *') return '매시간 정각'; if (cron === '*/10 * * * *') return '10분마다'; if (cron === '0 0 * * 0') return '매주 일요일 자정'; return cron; }

function generateScheduleDocs(schedules) {
  const scheduleDir = path.join(DOCS_OUTPUT_DIR, 'schedule');
  fs.mkdirSync(scheduleDir, { recursive: true });
  fs.writeFileSync(path.join(scheduleDir, '_category_.json'), JSON.stringify({ label: '자동 스케줄', position: 3, link: { type: 'generated-index', description: 'NIRA 자동 실행 스케줄 목록' } }, null, 2));
  let md = `---\nsidebar_position: 1\n---\n\n# 자동 스케줄\n\nNIRA가 정해진 시간에 자동으로 실행하는 작업들입니다.\n\n`;
  schedules.forEach(s => {
    md += `## ${s.name}\n\n**설명:** ${s.description}\n\n`;
    if (s.cronPatterns.length) {
      md += `**실행 시간:**\n`;
      s.cronPatterns.forEach(p => { md += `- \`${p}\` - ${cronToReadable(p)}\n`; });
      md += `\n`;
    }
    md += `**카테고리:** ${s.category}\n\n---\n\n`;
  });
  fs.writeFileSync(path.join(scheduleDir, 'index.md'), md);
}

function collectFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const all = fs.readdirSync(dir);
  const exts = ['.js', '.ts', '.mjs'];
  return all.filter(f => exts.includes(path.extname(f))).map(f => path.join(dir, f));
}

function main() {
  console.log('🚀 NIRA 문서 자동 생성 시작...');
  const cmdFiles = collectFiles(COMMANDS_DIR);
  if (cmdFiles.length) {
    const commands = cmdFiles.map(extractCommandInfo).filter(Boolean);
    commands.length ? generateCommandDocs(commands) : console.warn('⚠️ 명령어 파일이 없습니다.');
  } else { console.warn(`⚠️ 디렉토리/파일 없음: ${COMMANDS_DIR}`); }

  const schFiles = collectFiles(SCHEDULE_DIR);
  if (schFiles.length) {
    const schedules = schFiles.map(extractScheduleInfo).filter(Boolean);
    schedules.length ? generateScheduleDocs(schedules) : console.warn('⚠️ 스케줄 파일이 없습니다.');
  } else { console.warn(`⚠️ 디렉토리/파일 없음: ${SCHEDULE_DIR}`); }
  console.log('🎉 문서 생성 완료!');
}

main();

export { extractCommandInfo, extractScheduleInfo, generateCommandDocs, generateScheduleDocs };
