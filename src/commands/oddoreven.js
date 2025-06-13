import { SlashCommandBuilder } from '@discordjs/builders';
import _ from 'lodash';

export default {
  data: new SlashCommandBuilder()
    .setName('홀짝')
    .setDescription('무작위 숫자의 홀/짝을 맞춰보세요.')
    .addStringOption(o =>
      o.setName('선택')
       .setDescription('홀과 짝 중에 하나를 선택합니다.')
       .addChoices(
         { name: '홀', value: 'odd' },
         { name: '짝', value: 'even' }
       )
       .setRequired(true)
    ),

  async execute(interaction) {
    const choice = interaction.options.getString('선택');
    const answer = choice && /^odd|1/.test(choice) ? 1 : 0;
    const rand = _.random(1000000000);
    const oddOrEven = rand % 2;
    const text = oddOrEven === answer
      ? `맞았습니다! : ${rand}`
      : `틀렸습니다 : ${rand}`;

    await interaction.reply(text);
  },
};