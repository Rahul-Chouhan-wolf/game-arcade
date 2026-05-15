import { Category, WordLength } from './types'

export type CategoryData = Record<Category, { label: string; emoji: string; words: Record<WordLength, string[]> | null }>

export const CATEGORY_DATA: CategoryData = {
  any:       { label: 'Any',       emoji: '🔀', words: null },
  animals:   { label: 'Animals',   emoji: '🐾', words: {
    4: ['bear','boar','buck','bull','clam','colt','crab','crow','deer','dove','duck','fawn','flea','frog','gnat','hare','hawk','ibis','kite','lark','lion','lynx','mink','mole','moth','mule','newt','pike','pony','puma','slug','swan','toad','wasp','wolf','worm'],
    5: ['bison','camel','cobra','crane','dingo','eagle','egret','finch','gecko','goose','heron','hippo','horse','hyena','koala','llama','moose','mouse','otter','panda','quail','raven','robin','shark','sheep','skunk','sloth','snail','snake','squid','stork','tapir','tiger','trout','viper','whale','zebra'],
    6: ['badger','beaver','canary','cougar','coyote','donkey','falcon','ferret','gibbon','gopher','iguana','impala','jaguar','lizard','magpie','monkey','osprey','parrot','pigeon','puffin','python','rabbit','salmon','toucan','turtle','walrus','wombat'],
    7: ['buffalo','caribou','cheetah','dolphin','gazelle','gorilla','grizzly','hamster','leopard','lobster','manatee','narwhal','octopus','panther','peacock','pelican','penguin','piranha','raccoon','rooster','sparrow','vulture','wallaby'],
  }},
  countries: { label: 'Countries', emoji: '🌍', words: {
    4: ['chad','cuba','fiji','iran','iraq','laos','mali','oman','peru','togo'],
    5: ['benin','chile','china','egypt','ghana','india','italy','japan','kenya','libya','nauru','nepal','niger','qatar','spain','sudan','syria','tonga','wales','yemen'],
    6: ['angola','belize','brazil','canada','france','greece','guinea','israel','jordan','kuwait','malawi','mexico','monaco','norway','panama','poland','russia','serbia','sweden','taiwan','turkey','uganda','zambia'],
    7: ['albania','algeria','andorra','armenia','austria','bahrain','belarus','belgium','bolivia','croatia','denmark','ecuador','finland','georgia','germany','hungary','iceland','ireland','jamaica','moldova','myanmar','namibia','nigeria','romania','senegal','somalia','ukraine','uruguay','vanuatu','vietnam'],
  }},
  fruits:    { label: 'Fruits',    emoji: '🍎', words: {
    4: ['date','kiwi','lime','pear','plum'],
    5: ['apple','grape','guava','lemon','mango','melon','peach','prune'],
    6: ['banana','cherry','durian','lychee','orange','papaya','pomelo','quince','raisin'],
    7: ['apricot','avocado','coconut','kumquat','tangelo'],
  }},
  foods:     { label: 'Foods',     emoji: '🍕', words: {
    4: ['beef','beet','bran','cake','clam','corn','crab','curd','dill','duck','eggs','herb','kale','lamb','leek','meat','milk','okra','rice','sage','soup','taco','tofu','tuna','veal','yolk'],
    5: ['bagel','bacon','bread','candy','chips','cocoa','cream','crepe','curry','donut','fudge','gravy','grits','honey','kebab','liver','mochi','nacho','onion','pasta','pizza','queso','salad','salsa','sauce','steak','sushi','syrup','taffy','tapas','toast','wafer'],
    6: ['burger','cereal','cheese','cookie','danish','fondue','hummus','kimchi','muffin','noodle','paella','phyllo','quiche','scones','sorbet','waffle','yogurt'],
    7: ['biscuit','brownie','cabbage','caramel','chicken','chorizo','granola','goulash','lasagna','oatmeal','pancake','popcorn','pretzel','risotto','sausage','strudel'],
  }},
  sports:    { label: 'Sports',    emoji: '⚽', words: {
    4: ['golf','luge','polo','sumo','surf'],
    5: ['bocce','chess','darts','joust','relay','rodeo','rugby','skeet','track'],
    6: ['boxing','diving','hockey','karate','rowing','skiing','soccer','squash','tennis'],
    7: ['archery','bowling','cricket','cycling','fencing','fishing','hurdles','javelin','sailing','surfing','walking'],
  }},
  colors:    { label: 'Colors',    emoji: '🎨', words: {
    4: ['blue','buff','cyan','ecru','fawn','gold','gray','grey','jade','lime','navy','onyx','pink','plum','rose','ruby','rust','sage','teal'],
    5: ['amber','azure','beige','black','blaze','brass','brick','brown','camel','cocoa','coral','cream','ebony','ember','green','hazel','honey','ivory','khaki','lilac','mauve','ocher','olive','peach','rouge','sepia','smoke','steel','straw','taupe','umber','white'],
    6: ['auburn','bisque','bistre','cerise','citron','claret','cobalt','copper','desert','fallow','flaxen','garnet','golden','indigo','jasper','laurel','madder','maroon','myrtle','orange','orchid','pewter','purple','raisin','russet','salmon','sienna','silver','sorrel','timber','violet','walnut','yellow'],
    7: ['apricot','chamois','crimson','fuchsia','magenta','mustard','scarlet','thistle'],
  }},
}
