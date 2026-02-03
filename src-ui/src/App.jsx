import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

// Импортируем компоненты UI
import { 
  Container, Typography, TextField, Button, Card, CardContent, 
  IconButton, Box, AppBar, Toolbar, CircularProgress, Chip,
  Tabs, Tab, Badge, Grid
} from '@mui/material'

// Импортируем иконки
import { 
  Add, Remove, Delete, Save, 
  ShoppingCart, Inventory, CheckCircle, Settings 
} from '@mui/icons-material'

function App() {
  const [items, setItems] = useState([]) 
  const [loading, setLoading] = useState(true)
  const [newItemName, setNewItemName] = useState('')
  
  // Состояние для вкладок (0 = Склад, 1 = Список покупок)
  const [tabIndex, setTabIndex] = useState(0)

  // --- ЛОГИКА ---
  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .order('id', { ascending: true }) // Сортируем по ID, чтобы не прыгали
    if (!error) setItems(data || [])
    setLoading(false)
  }

  // Обновление количества (Основная функция)
  async function updateQuantity(id, currentQty, change) {
    const newQty = currentQty + change
    if (newQty < 0) return

    // Оптимистичное обновление (сразу на экране)
    setItems(items.map(i => i.id === id ? { ...i, current_quantity: newQty } : i))
    
    // Отправка в базу
    await supabase.from('inventory_items').update({ current_quantity: newQty }).eq('id', id)
  }

  // Обновление ПОРОГА (Min Threshold) - Наша новая гибкая функция
  async function updateThreshold(id, currentThreshold, change) {
    const newThreshold = currentThreshold + change
    if (newThreshold < 0) return // Не может быть меньше 0

    setItems(items.map(i => i.id === id ? { ...i, min_threshold: newThreshold } : i))
    await supabase.from('inventory_items').update({ min_threshold: newThreshold }).eq('id', id)
  }

  async function addNewItem() {
    if (!newItemName.trim()) return
    // По умолчанию создаем с 0 количеством и порогом 1
    const { data, error } = await supabase
      .from('inventory_items')
      .insert([{ name: newItemName, current_quantity: 0, min_threshold: 1 }])
      .select()
    if (!error && data) {
      setItems([...items, ...data])
      setNewItemName('')
    }
  }

  async function deleteItem(id) {
    if (!confirm('Точно удалить товар навсегда?')) return
    setItems(items.filter(i => i.id !== id))
    await supabase.from('inventory_items').delete().eq('id', id)
  }

  // Функция покупки (Когда нажимаем "Куплено")
  // Добавляет столько, чтобы стало равно порогу + запас (пока просто +1)
  async function markAsBought(id, currentQty) {
      await updateQuantity(id, currentQty, 1)
  }

  // --- ВЫЧИСЛЕНИЯ ---
  // Фильтруем список покупок (где текущее < минимума)
  const shoppingList = items.filter(i => i.current_quantity < i.min_threshold)
  // Счетчик для бейджика (красный кружок с цифрой)
  const itemsToBuyCount = shoppingList.length

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      
      {/* Шапка */}
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Life ERP
          </Typography>
        </Toolbar>
        
        {/* Табы (Переключатели) */}
        <Tabs 
            value={tabIndex} 
            onChange={(e, newVal) => setTabIndex(newVal)} 
            textColor="inherit" 
            indicatorColor="secondary"
            variant="fullWidth"
        >
            <Tab icon={<Inventory />} label="Склад" />
            <Tab 
                icon={
                    <Badge badgeContent={itemsToBuyCount} color="error">
                        <ShoppingCart />
                    </Badge>
                } 
                label="Купить" 
            />
        </Tabs>
      </AppBar>

      <Container maxWidth="sm" sx={{ mt: 3, pb: 4 }}>

        {/* --- ВКЛАДКА 0: СКЛАД --- */}
        {tabIndex === 0 && (
          <>
            {/* Добавлялка */}
            <Card sx={{ p: 2, mb: 3, display: 'flex', gap: 1 }}>
              <TextField 
                fullWidth 
                label="Новый товар (напр. Соль)" 
                variant="outlined" 
                size="small"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addNewItem()}
              />
              <Button variant="contained" onClick={addNewItem}>
                <Add />
              </Button>
            </Card>

            {/* Список всех товаров */}
            <Box display="flex" flexDirection="column" gap={2}>
              {items.map(item => {
                 const isLow = item.current_quantity < item.min_threshold;
                 return (
                  <Card key={item.id} sx={{ borderLeft: isLow ? '5px solid red' : '5px solid green' }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="h6">{item.name}</Typography>
                        <Chip 
                            label={item.current_quantity + ' шт'} 
                            color={isLow ? "error" : "success"} 
                            variant={isLow ? "filled" : "outlined"}
                        />
                      </Box>
                      
                      <Grid container spacing={2} alignItems="center">
                          {/* Управление количеством */}
                          <Grid item xs={6} display="flex" alignItems="center">
                              <IconButton size="small" onClick={() => updateQuantity(item.id, item.current_quantity, -1)}><Remove /></IconButton>
                              <Typography sx={{ mx: 1 }}>Факт</Typography>
                              <IconButton size="small" onClick={() => updateQuantity(item.id, item.current_quantity, 1)}><Add /></IconButton>
                          </Grid>

                          {/* Управление порогом (Настройка) */}
                          <Grid item xs={6} display="flex" alignItems="center" justifyContent="flex-end">
                              <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                                  Мин: {item.min_threshold}
                              </Typography>
                              <Box sx={{ border: '1px solid #ddd', borderRadius: 1 }}>
                                <IconButton size="small" onClick={() => updateThreshold(item.id, item.min_threshold, -1)}><Remove fontSize="small"/></IconButton>
                                <IconButton size="small" onClick={() => updateThreshold(item.id, item.min_threshold, 1)}><Add fontSize="small"/></IconButton>
                              </Box>
                          </Grid>
                      </Grid>
                      
                      {/* Кнопка удаления */}
                      <Box display="flex" justifyContent="flex-end" mt={1}>
                         <IconButton size="small" onClick={() => deleteItem(item.id)} color="default"><Delete fontSize="small"/></IconButton>
                      </Box>

                    </CardContent>
                  </Card>
                 )
              })}
            </Box>
          </>
        )}

        {/* --- ВКЛАДКА 1: СПИСОК ПОКУПОК --- */}
        {tabIndex === 1 && (
            <Box display="flex" flexDirection="column" gap={2}>
                {shoppingList.length === 0 ? (
                    <Typography align="center" color="text.secondary" mt={4}>
                        Всего хватает! Склад полон. 🎉
                    </Typography>
                ) : (
                    shoppingList.map(item => (
                        <Card key={item.id}>
                            <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                    <Typography variant="h6">{item.name}</Typography>
                                    <Typography variant="body2" color="error">
                                        Остаток: {item.current_quantity} (Надо: {item.min_threshold})
                                    </Typography>
                                </Box>
                                <Button 
                                    variant="contained" 
                                    color="primary" 
                                    startIcon={<CheckCircle />}
                                    onClick={() => markAsBought(item.id, item.current_quantity)}
                                >
                                    Купил
                                </Button>
                            </CardContent>
                        </Card>
                    ))
                )}
            </Box>
        )}

      </Container>
    </Box>
  )
}

export default App