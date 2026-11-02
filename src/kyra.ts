// Kyra, la mascota del compilador: una boston terrier dibujada con líneas
// sobre su foto (orejas de murciélago, la franja blanca entre los ojos que
// baja hasta el hocico, y la nariz chata).
// Se exporta como lista de líneas para que main.ts la enmarque.
export const kyra = String.raw`
   __                                      __
  /  \                                    /  \
 /    \                                  /    \
|  /\  \                                /  /\  |
|  \ \  \______________________________/  / /  |
 \  \ \             |      |             / /  /
  \  \/             |      |             \/  /
   \  |             |      |             |  /
    \ |    ___      |      |      ___    | /
     \|   / @ \     /      \     / @ \   |/
      |   \___/    /        \    \___/   |
      |           /          \           |
       \         |    ____    |         /
        \        |   (____)   |        /
         \        \    ||    /        /
          \        \_  ||  _/        /
           '.        \_/\_/        .'
             '-.                .-'
                '-.__________.-'
`.slice(1, -1).split("\n");
