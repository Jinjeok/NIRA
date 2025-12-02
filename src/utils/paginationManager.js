import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

/**
 * Creates pagination buttons for an interaction.
 * @param {number} currentPage - The current page index (0-based).
 * @param {number} totalPages - The total number of pages.
 * @param {string} interactionId - The ID of the original interaction.
 * @param {string} prefix - The prefix for the custom ID (e.g., 'gemini_page_', 'perplexity_page_').
 * @returns {ActionRowBuilder} The action row containing the buttons.
 */
export function createPaginationButtons(currentPage, totalPages, interactionId, prefix) {
    const row = new ActionRowBuilder();
    const maxButtons = 5;

    let startPage = 0;
    let endPage = totalPages - 1;

    if (totalPages > maxButtons) {
        const half = Math.floor(maxButtons / 2);
        startPage = Math.max(0, currentPage - half);
        endPage = startPage + maxButtons - 1;

        if (endPage >= totalPages) {
            endPage = totalPages - 1;
            startPage = Math.max(0, endPage - maxButtons + 1);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`${prefix}${i}:${interactionId}`)
                .setLabel(`${i + 1}`)
                .setStyle(i === currentPage ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setDisabled(i === currentPage)
        );
    }

    return row;
}
