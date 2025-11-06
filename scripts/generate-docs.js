#!/usr/bin/env node

/**
 * NIRA 명령어 및 스케줄 문서 자동 생성 스크립트
 * src/commands/ 와 src/schedule/ 디렉토리를 스캔해서 Docusaurus 문서 생성
 */

const fs = require('fs');
const path = require('path');

const COMMANDS_DIR = './src/commands';
const SCHEDULE_DIR = './src/schedule';
const DOCS_OUTPUT_DIR = './docs/docs';

// 명령어 카테고리 분류
const CATEGORIES = {
  utility: {
    name: '유틸리티',
    description: '계산, 변환, 시간 등 일상적인 도구들',
    keywords: ['calculation', 'clock', 'length', 'exchange', 'base64', 'color']
  },
  information: {
    name: '정보 조회',
    description: '주식, 환율, 핫딜 등 실시간 정보 조회',
    keywords: ['stock', 'hotdeal', 'price', 'exchange', 'newsletter']
  },
  fun: {
    name: '재미/게임',
    description: '주사위, 동전, 추첨 등 재미있는 기능들',
    keywords: ['coin', 'choice', 'random', 'lottory', 'omikuji', 'oddoreven', 'simulation']
  },
  text: {
    name: '텍스트 처리',
    description: '텍스트 변환, 처리 관련 기능들',
    keywords: ['reverse', 'say', 'random_letter', 'thatlong']
  },
  admin: {
    name: '관리/시스템',
    description: '봇 관리 및 시스템 기능들',
    keywords: ['delete', 'upgrade', 'ping', 'invite', 'homepage']
  },
  social: {
    name: '소셜/커뮤니티',
    description: '투표, 아바타 등 소셜 기능들',
    keywords: ['vote', 'avatar', 'vxtwitter']
  },
  misc: {
    name: '기타',
    description: '기타 다양한 기능들',
    keywords: ['dday', 'years', 'emoji', 'mart', 'tax', 'gemini']
  }
};

/**
 * JavaScript 파일에서 명령어 정보 추출
 */
function extractCommandInfo(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath, '.js');
    
    // SlashCommandBuilder에서 이름과 설명 추출
    const nameMatch = content.match(/\.setName\(['"`]([^'"`]+)['"`]\)/);
    const descMatch = content.match(/\.setDescription\(['"`]([^'"`]+)['"`]\)/);
    
    // 옵션 추출
    const optionMatches = content.matchAll(/\.addStringOption|addIntegerOption|addBooleanOption|addUserOption|addChannelOption\([^}]+\}/g);
    const options = [];
    for (const match of optionMatches) {
      const optionStr = match[0];
      const optName = optionStr.match(/\.setName\(['"`]([^'"`]+)['"`]\)/);
      const optDesc = optionStr.match(/\.setDescription\(['"`]([^'"`]+)['"`]\)/);
      const required = optionStr.includes('.setRequired(true)');
      
      if (optName && optDesc) {
        options.push({
          name: optName[1],
          description: optDesc[1],
          required: required
        });
      }
    }
    
    // 사용 예시 추출 (주석에서)
    const exampleMatch = content.match(/\/\*\*?[\s\S]*?예시[\s\S]*?\*\//i) || 
                        content.match(/\/\/.*예시.*/);
    
    return {
      fileName,
      name: nameMatch ? nameMatch[1] : fileName,
      description: descMatch ? descMatch[1] : '설명 없음',
      options,
      example: exampleMatch ? exampleMatch[0].replace(/\/\*\*?|\*\//g, '').trim() : null,
      category: categorizeCommand(fileName)
    };
  } catch (error) {
    console.warn(`파일 처리 중 오류 (${filePath}):`, error.message);
    return null;
  }
}

/**
 * 파일명으로 카테고리 분류
 */
function categorizeCommand(fileName) {
  for (const [categoryId, category] of Object.entries(CATEGORIES)) {
    if (category.keywords.includes(fileName)) {
      return categoryId;
    }
  }
  return 'misc';
}

/**
 * 스케줄 정보 추출
 */
function extractScheduleInfo(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath, '.js');
    
    // cron 패턴 추출
    const cronMatches = content.matchAll(/['"`]([0-9*\/,-]+\s+[0-9*\/,-]+\s+[0-9*\/,-]+\s+[0-9*\/,-]+\s+[0-9*\/,-]+)['"`]/g);
    const cronPatterns = [...cronMatches].map(match => match[1]);
    
    // 설명 추출 (주석에서)
    const descMatch = content.match(/\/\*\*?([^*]+(?:\*(?!\/)[^*]*)*)\*\//); 
    const lineCommentMatch = content.match(/\/\/\s*(.+)/);
    
    return {
      fileName,
      name: fileName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      description: descMatch ? descMatch[1].trim() : 
                   lineCommentMatch ? lineCommentMatch[1].trim() : '설명 없음',
      cronPatterns,
      category: categorizeSchedule(fileName)
    };
  } catch (error) {
    console.warn(`스케줄 파일 처리 중 오류 (${filePath}):`, error.message);
    return null;
  }
}

/**
 * 스케줄 카테고리 분류
 */
function categorizeSchedule(fileName) {
  if (fileName.includes('hotdeal') || fileName.includes('Hotdeal')) return 'hotdeal';
  if (fileName.includes('news') || fileName.includes('News')) return 'news';
  if (fileName.includes('karaoke') || fileName.includes('Karaoke')) return 'entertainment';
  if (fileName.includes('splatoon') || fileName.includes('Splatoon')) return 'gaming';
  return 'misc';
}

/**
 * 명령어 문서 생성
 */
function generateCommandDocs(commands) {
  // 카테고리별로 그룹화
  const groupedCommands = {};
  commands.forEach(cmd => {
    if (!groupedCommands[cmd.category]) {
      groupedCommands[cmd.category] = [];
    }
    groupedCommands[cmd.category].push(cmd);
  });
  
  // 카테고리 색인 페이지
  let indexContent = `---
sidebar_position: 1
---

# 명령어 목록

NIRA가 제공하는 모든 슬래시 명령어들입니다.

`;
  
  Object.entries(groupedCommands).forEach(([categoryId, cmds]) => {
    const category = CATEGORIES[categoryId];
    indexContent += `## ${category.name}\n\n${category.description}\n\n`;
    cmds.forEach(cmd => {
      indexContent += `- **\`/${cmd.name}\`** - ${cmd.description}\n`;
    });
    indexContent += `\n`;
  });
  
  // 인덱스 파일 생성
  const commandsDir = path.join(DOCS_OUTPUT_DIR, 'commands');
  if (!fs.existsSync(commandsDir)) {
    fs.mkdirSync(commandsDir, { recursive: true });
  }
  
  fs.writeFileSync(path.join(commandsDir, 'index.md'), indexContent);
  
  // 카테고리 설정 파일
  const categoryConfig = {
    label: '명령어',
    position: 3,
    link: {
      type: 'generated-index',
      description: 'NIRA의 모든 슬래시 명령어들을 카테고리별로 확인하세요.'
    }
  };
  fs.writeFileSync(path.join(commandsDir, '_category_.json'), JSON.stringify(categoryConfig, null, 2));
  
  // 카테고리별 상세 문서 생성
  Object.entries(groupedCommands).forEach(([categoryId, cmds]) => {
    const category = CATEGORIES[categoryId];
    let content = `---\nsidebar_position: ${Object.keys(CATEGORIES).indexOf(categoryId) + 2}\n---\n\n`;
    content += `# ${category.name}\n\n${category.description}\n\n`;
    
    cmds.forEach(cmd => {
      content += `## \`/${cmd.name}\`\n\n**설명:** ${cmd.description}\n\n`;
      
      if (cmd.options.length > 0) {
        content += `**옵션:**\n\n`;
        cmd.options.forEach(opt => {
          const required = opt.required ? ' *(필수)*' : ' *(선택)*';
          content += `- **\`${opt.name}\`**${required}: ${opt.description}\n`;
        });
        content += `\n`;
      }
      
      content += `**사용법:**\n\`\`\`\n/${cmd.name}`;
      if (cmd.options.length > 0) {
        const requiredOpts = cmd.options.filter(opt => opt.required);
        if (requiredOpts.length > 0) {
          content += ' ' + requiredOpts.map(opt => `<${opt.name}>`).join(' ');
        }
        const optionalOpts = cmd.options.filter(opt => !opt.required);
        if (optionalOpts.length > 0) {
          content += ' [' + optionalOpts.map(opt => opt.name).join('] [') + ']';
        }
      }
      content += `\n\`\`\`\n\n`;
      
      if (cmd.example) {
        content += `**예시:**\n${cmd.example}\n\n`;
      }
      
      content += `---\n\n`;
    });
    
    fs.writeFileSync(path.join(commandsDir, `${categoryId}.md`), content);
  });
  
  console.log(`✅ ${commands.length}개 명령어 문서 생성 완료`);
}

/**
 * 스케줄 문서 생성
 */
function generateScheduleDocs(schedules) {
  const scheduleDir = path.join(DOCS_OUTPUT_DIR, 'schedule');
  if (!fs.existsSync(scheduleDir)) {
    fs.mkdirSync(scheduleDir, { recursive: true });
  }
  
  // 카테고리 설정
  const categoryConfig = {
    label: '자동 스케줄',
    position: 4,
    link: {
      type: 'generated-index',
      description: 'NIRA가 자동으로 실행하는 스케줄 작업들입니다.'
    }
  };
  fs.writeFileSync(path.join(scheduleDir, '_category_.json'), JSON.stringify(categoryConfig, null, 2));
  
  // 스케줄 목록 페이지
  let content = `---\nsidebar_position: 1\n---\n\n# 자동 스케줄\n\n`;
  content += `NIRA가 정해진 시간에 자동으로 실행하는 작업들입니다.\n\n`;
  
  schedules.forEach((schedule, index) => {
    content += `## ${schedule.name}\n\n**설명:** ${schedule.description}\n\n`;
    
    if (schedule.cronPatterns.length > 0) {
      content += `**실행 시간:**\n`;
      schedule.cronPatterns.forEach(pattern => {
        const readable = cronToReadable(pattern);
        content += `- \`${pattern}\` - ${readable}\n`;
      });
      content += `\n`;
    }
    
    content += `**카테고리:** ${schedule.category}\n\n---\n\n`;
  });
  
  fs.writeFileSync(path.join(scheduleDir, 'index.md'), content);
  console.log(`✅ ${schedules.length}개 스케줄 문서 생성 완료`);
}

/**
 * CRON 패턴을 읽기 쉬운 형태로 변환
 */
function cronToReadable(cron) {
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;
  
  const [minute, hour, day, month, weekday] = parts;
  
  // 간단한 패턴 몇 개만 변환
  if (cron === '0 9 * * *') return '매일 오전 9시';
  if (cron === '0 * * * *') return '매시간 정각';
  if (cron === '*/10 * * * *') return '10분마다';
  if (cron === '0 0 * * 0') return '매주 일요일 자정';
  
  return cron; // 복잡한 패턴은 그대로 표시
}

/**
 * 메인 실행 함수
 */
function main() {
  console.log('🚀 NIRA 문서 자동 생성 시작...');
  
  // 명령어 스캔 및 문서 생성
  if (fs.existsSync(COMMANDS_DIR)) {
    const commandFiles = fs.readdirSync(COMMANDS_DIR)
      .filter(file => file.endsWith('.js'))
      .map(file => path.join(COMMANDS_DIR, file));
    
    const commands = commandFiles
      .map(extractCommandInfo)
      .filter(cmd => cmd !== null);
    
    if (commands.length > 0) {
      generateCommandDocs(commands);
    } else {
      console.warn('⚠️ 명령어를 찾을 수 없습니다.');
    }
  } else {
    console.warn(`⚠️ 명령어 디렉토리를 찾을 수 없습니다: ${COMMANDS_DIR}`);
  }
  
  // 스케줄 스캔 및 문서 생성
  if (fs.existsSync(SCHEDULE_DIR)) {
    const scheduleFiles = fs.readdirSync(SCHEDULE_DIR)
      .filter(file => file.endsWith('.js'))
      .map(file => path.join(SCHEDULE_DIR, file));
    
    const schedules = scheduleFiles
      .map(extractScheduleInfo)
      .filter(schedule => schedule !== null);
    
    if (schedules.length > 0) {
      generateScheduleDocs(schedules);
    } else {
      console.warn('⚠️ 스케줄을 찾을 수 없습니다.');
    }
  } else {
    console.warn(`⚠️ 스케줄 디렉토리를 찾을 수 없습니다: ${SCHEDULE_DIR}`);
  }
  
  console.log('🎉 문서 생성 완료!');
}

if (require.main === module) {
  main();
}

module.exports = { extractCommandInfo, extractScheduleInfo, generateCommandDocs, generateScheduleDocs };
