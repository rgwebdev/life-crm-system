import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { parseUserCommand } from './aiAssistant' // Подключаем наш новый мозг

import { 
  Container, Typography, TextField, Button, Card, CardContent, 
  IconButton, Box, AppBar, Toolbar, Chip,
  Tabs, Tab, Badge, Grid, Select, MenuItem, InputLabel, FormControl,
  List, ListItem, ListItemText, Divider, Paper, CircularProgress,
  Snackbar, Alert
} from '@mui/material'

import { 
  Add, Remove, Delete, ShoppingCart, Inventory, Storefront,
  Mic, Send, AutoAwesome
} from '@mui/icons-material'

function App() {
  const [items, setItems] = useState([]) 
  const [activities, setActivities] = useState([]) // Новая таблица
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Magic Input State
  const [commandText, setCommandText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [notification, setNotification] = useState({ open: false, msg: '', type: 'info' })

  const [tabIndex, setTabIndex] = useState(0)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data: iData } = await supabase.from('inventory_items').select('*').order('id')
    const { data: sData } = await supabase.from('shops').select('*').order('id')
    // Загружаем активности для контекста AI
    const { data: aData } = await supabase.from('activities').select('*')

    if (iData) setItems(iData)
    if (sData) setShops(sData)
    if (aData) setActivities(aData)
    setLoading(false)
  }

  // --- AI MAGIC HANDLER ---
  async function handleSendCommand() {
    if (!commandText.trim()) return;
    console.log("MY KEY:", import.meta.env.VITE_GEMINI_API_KEY);
    setIsProcessing(true);

    // 1. Спрашиваем Gemini
    const commands = await parseUserCommand(commandText, items, activities);
    console.log("AI Parsed:", commands);

    if (!commands || commands.length === 0) {
        setNotification({ open: true, msg: 'AI не понял команду', type: 'error' });
        setIsProcessing(false);
        return;
    }

    let successCount = 0;

    // 2. Выполняем команды
    for (const cmd of commands) {
        try {
            // A. СКЛАД (INVENTORY)
            if (cmd.type === 'inventory') {
                const existingItem = items.find(i => i.name.toLowerCase() === cmd.item_name.toLowerCase());
                
                if (existingItem) {
                    let newQty = cmd.is_absolute 
                        ? cmd.qty_update 
                        : existingItem.current_quantity + cmd.qty_update; // "Купил 5" -> +5
                    
                    if (newQty < 0) newQty = 0;

                    await supabase.from('inventory_items')
                        .update({ current_quantity: newQty })
                        .eq('id', existingItem.id);
                } else {
                    // Если товара нет - пока просто уведомляем (в будущем можно создавать)
                    console.log("Товар не найден, создание пока отключено для безопасности");
                }
                successCount++;
            }

            // B. АКТИВНОСТЬ (ACTIVITY)
            if (cmd.type === 'activity') {
                // Ищем ID активности по имени
                let act = activities.find(a => a.name.toLowerCase().includes(cmd.activity_name.toLowerCase()));
                
                if (act) {
                    await supabase.from('activity_logs').insert([{
                        activity_id: act.id,
                        value_numeric: cmd.val_num || null,
                        value_text: cmd.val_text || null
                    }]);
                    successCount++;
                }
            }

            // C. ЖУРНАЛ (JOURNAL)
            if (cmd.type === 'journal') {
                await supabase.from('journal').insert([{
                    content: cmd.content,
                    tags: cmd.tags,
                    entry_type: 'reflection'
                }]);
                successCount++;
            }

        } catch (e) {
            console.error("Ошибка выполнения команды:", e);
        }
    }

    // 3. Обновляем экран
    await fetchData();
    setCommandText('');
    setIsProcessing(false);
    setNotification({ open: true, msg: `Выполнено действий: ${successCount}`, type: 'success' });
  }

  // --- UI RENDER (Оставим старый код вкладок, но добавим Footer) ---
  
  // ... (Тут функции обновления количества, которые были раньше - оставь их как есть или скопируй из прошлой версии, 
  // чтобы не раздувать ответ я их сократил, но они нужны!)
  // ДЛЯ ТЕБЯ: Вставь сюда updateQuantityDelta, updateLocalAndDb и т.д. из версии v0.4.0
  async function updateLocalAndDb(id, field, value) {
    setItems(prevItems => prevItems.map(i => i.id === id ? { ...i, [field]: value } : i))
    await supabase.from('inventory_items').update({ [field]: value }).eq('id', id)
  }
  async function updateQuantityDelta(id, currentQty, change) {
    const newQty = parseInt(currentQty) + change; if (newQty < 0) return;
    updateLocalAndDb(id, 'current_quantity', newQty)
  }
  // ... (Остальные функции handleManual... можно пока убрать для краткости или оставить)

  // Группировка для списка (нужна для рендера)
  const shoppingList = items.filter(i => i.current_quantity < i.min_threshold);
  const groupedShoppingList = shoppingList.reduce((acc, item) => {
      const shopId = item.shop_id || 'unknown';
      if (!acc[shopId]) acc[shopId] = [];
      acc[shopId].push(item);
      return acc;
  }, {});
  const getShopName = (id) => {
      if (id === 'unknown') return 'Не определено';
      const shop = shops.find(s => s.id == id); // == важно!
      return shop ? shop.name : 'Неизвестный магазин';
  }

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: '#f5f5f5', pb: 10 }}> {/* pb:10 место для футера */}
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Life ERP</Typography>
        </Toolbar>
        <Tabs value={tabIndex} onChange={(e, v) => setTabIndex(v)} textColor="inherit" indicatorColor="secondary" variant="fullWidth">
            <Tab icon={<Inventory />} label="Склад" />
            <Tab icon={<Badge badgeContent={shoppingList.length} color="error"><ShoppingCart /></Badge>} label="Купить" />
        </Tabs>
      </AppBar>

      <Container maxWidth="sm" sx={{ mt: 3 }}>
        {/* --- Вкл 1: СКЛАД --- */}
        {tabIndex === 0 && (
            <Box display="flex" flexDirection="column" gap={2}>
              {items.map(item => (
                  <Card key={item.id} sx={{ borderLeft: item.current_quantity < item.min_threshold ? '5px solid red' : '5px solid green' }}>
                    <CardContent sx={{ pb: '16px !important', display: 'flex', justifyContent: 'space-between' }}>
                        <Box>
                            <Typography variant="h6">{item.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Остаток: {item.current_quantity} {item.unit || 'шт'}
                            </Typography>
                        </Box>
                        {/* Упрощенный вид для теста AI */}
                        <Chip label={item.current_quantity} />
                    </CardContent>
                  </Card>
              ))}
            </Box>
        )}

        {/* --- Вкл 2: СПИСОК --- */}
        {tabIndex === 1 && (
             <Box display="flex" flexDirection="column" gap={2}>
             {Object.keys(groupedShoppingList).map(shopId => (
                 <Paper key={shopId} sx={{ p: 2 }}>
                     <Typography variant="subtitle1" fontWeight="bold" color="primary">{getShopName(shopId)}</Typography>
                     {groupedShoppingList[shopId].map(item => (
                         <Typography key={item.id}>• {item.name} (Надо: {item.min_threshold - item.current_quantity})</Typography>
                     ))}
                 </Paper>
             ))}
         </Box>
        )}
      </Container>

      {/* --- МАГИЧЕСКАЯ ПАНЕЛЬ (FOOTER) --- */}
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, p: 2, zIndex: 10 }} elevation={10}>
        <Box display="flex" gap={1} alignItems="center">
            <IconButton color="primary"><Mic /></IconButton>
            <TextField 
                fullWidth 
                placeholder="Бицепс 4 подхода, осталось 5 яиц..." 
                variant="outlined" 
                size="small"
                value={commandText}
                onChange={(e) => setCommandText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendCommand()}
                disabled={isProcessing}
            />
            <Button 
                variant="contained" 
                onClick={handleSendCommand}
                disabled={isProcessing}
                endIcon={isProcessing ? <CircularProgress size={20} color="inherit"/> : <Send />}
            >
                {isProcessing ? '' : 'GO'}
            </Button>
        </Box>
      </Paper>
      
      {/* Уведомлялка */}
      <Snackbar open={notification.open} autoHideDuration={4000} onClose={() => setNotification({...notification, open: false})}>
        <Alert severity={notification.type}>{notification.msg}</Alert>
      </Snackbar>

    </Box>
  )
}

export default App