import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } from 'discord.js';

// NIRA 봇의 모든 현재 기능을 위한 고정 권한 세트
const NIRA_REQUIRED_PERMISSIONS = [
    PermissionsBitField.Flags.SendMessages,    // 메시지 전송 권한
    PermissionsBitField.Flags.EmbedLinks,      // 임베드 링크 표시 권한
    PermissionsBitField.Flags.ManageMessages,  // 메시지 관리 권한 (예: /메시지삭제)
];

export default {
    data: new SlashCommandBuilder()
        .setName('초대하기')
        .setDescription('NIRA 봇을 서버에 초대하는 링크를 생성합니다.'),

    async execute(interaction) {
        const clientId = interaction.client.user.id;

        const permissionsValue = new PermissionsBitField(NIRA_REQUIRED_PERMISSIONS).bitfield.toString();
        const permissionsDescription = NIRA_REQUIRED_PERMISSIONS.map(perm => {
            // PermissionsBitField.Flags에서 키 이름을 가져오려고 시도합니다.
            const permName = Object.keys(PermissionsBitField.Flags).find(key => PermissionsBitField.Flags[key] === perm);
            return permName || `권한값: ${perm}`;
        }).join(', ');

        const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissionsValue}&scope=bot%20applications.commands`;

        const embed = new EmbedBuilder()
            .setColor(0xEE82EE) // NIRA 테마 색상
            .setTitle('🔗 NIRA 봇 초대하기')
            .setDescription('아래 버튼을 클릭하거나 URL을 복사하여 NIRA를 당신의 서버에 초대하세요!')
            .addFields(
                { name: '요청되는 권한', value: `봇의 모든 기능을 사용하기 위해 다음 권한이 요청됩니다:\n\`\`\`${permissionsDescription}\`\`\`` },
                { name: '초대 URL', value: `\`${inviteUrl}\`` }
            )
            .setFooter({ text: '봇을 초대한 후, 특정 채널에서 명령어가 작동하려면 채널별 권한도 확인해주세요.'})

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('NIRA 초대하기')
                    .setStyle(ButtonStyle.Link)
                    .setURL(inviteUrl)
            );

        // 이 메시지는 사용자에게만 보이도록 ephemeral로 설정하는 것이 좋습니다.
        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    },
};